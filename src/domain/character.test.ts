import { describe, expect, it } from 'vitest';
import {
  addToHistory,
  CHARACTER_SCHEMA_VERSION,
  createCharacter,
  exportCharacter,
  HISTORY_LIMIT,
  importCharacter,
  loadCharacter,
  type RollRecord,
} from './character';
import { runMigrations, SchemaError } from './schema/migrate';
import { defaultSheet } from './sheet/sheet';

function record(i: number): RollRecord {
  return {
    id: `r${i}`,
    formula: '1d20+5',
    mode: 'advantage',
    terms: [
      {
        sign: 1,
        notation: '1d20',
        dice: [
          { sides: 20, value: 3, kept: false },
          { sides: 20, value: 15, kept: true },
        ],
        subtotal: 15,
      },
      { sign: 1, notation: '5', flat: 5, dice: [], subtotal: 5 },
    ],
    total: 20,
    crit: false,
    fumble: false,
    at: 1_700_000_000_000 + i,
    label: 'Attacco',
  };
}

describe('loadCharacter', () => {
  it('accepts a freshly created character unchanged', () => {
    const c = createCharacter('Thalia');
    c.history = [record(1)];
    expect(loadCharacter(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it('fills defaults and clamps an untrusted, partial document', () => {
    const c = loadCharacter({
      id: 'x',
      name: 42,
      hp: { cur: 999, max: 12, temp: -3 },
      deathSaves: { successes: 7, failures: 'a' },
      rollMode: 'sideways',
      presets: [{ name: 'Rotto', formula: 'd20+' }, { name: 'Buono', formula: 'd6' }],
      history: [{ formula: '' }, { formula: 'd6', total: 4, terms: 'nope' }],
    });
    expect(c.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
    expect(c.name).toBe('Senza nome');
    expect(c.hp).toEqual({ cur: 12, max: 12, temp: 0 });
    expect(c.deathSaves).toEqual({ successes: 3, failures: 0 });
    expect(c.rollMode).toBe('normal');
    expect(c.presets.map((p) => p.name)).toEqual(['Buono']);
    expect(c.history).toHaveLength(1);
    expect(c.history[0]).toMatchObject({ formula: 'd6', total: 4, terms: [] });
  });

  it('refuses data from a newer schema', () => {
    expect(() => loadCharacter({ schemaVersion: CHARACTER_SCHEMA_VERSION + 1 })).toThrow(SchemaError);
  });

  it('refuses non-objects', () => {
    expect(() => loadCharacter(null)).toThrow(SchemaError);
    expect(() => loadCharacter([1, 2])).toThrow(SchemaError);
  });
});

describe('migration v1 → v2', () => {
  // A character as saved by Phase 0 and 1 (localStorage, Firestore or an export file).
  const v1 = {
    schemaVersion: 1,
    id: 'c1',
    name: 'Brann',
    hp: { cur: 7, max: 27, temp: 2 },
    deathSaves: { successes: 0, failures: 0 },
    rollMode: 'advantage',
    presets: [{ id: 'p1', name: 'Martello', formula: '1d20+5' }],
    history: [record(1)],
    updatedAt: 1_700_000_000_000,
  };

  it('adds a blank sheet and keeps everything else', () => {
    const c = loadCharacter(v1);
    expect(c.schemaVersion).toBe(2);
    expect(c.sheet).toEqual(defaultSheet());
    expect({ ...c, sheet: undefined, schemaVersion: 1 }).toEqual({ ...v1, sheet: undefined });
  });

  it('imports a v1 export file', () => {
    const file = JSON.stringify({ kind: 'dnd-companion/character', exportedAt: '2026-09-01T10:00:00Z', character: v1 });
    expect(importCharacter(file).sheet.languages).toEqual(['Comune']);
  });
});

describe('runMigrations', () => {
  const migrations = {
    1: (d: Record<string, unknown>) => ({ ...d, hp: { cur: d.hp, max: d.hp, temp: 0 } }),
    2: (d: Record<string, unknown>) => ({ ...d, name: String(d.name).trim() }),
  };

  it('runs each step in order from the stored version', () => {
    expect(runMigrations({ schemaVersion: 1, hp: 8, name: ' Bo ' }, 3, migrations)).toEqual({
      schemaVersion: 3,
      hp: { cur: 8, max: 8, temp: 0 },
      name: 'Bo',
    });
    expect(runMigrations({ schemaVersion: 2, hp: 1, name: ' Bo ' }, 3, migrations)).toMatchObject({ name: 'Bo', hp: 1 });
  });

  it('treats a missing version as 1', () => {
    expect(runMigrations({ hp: 8, name: 'Bo' }, 2, migrations)).toMatchObject({ schemaVersion: 2, hp: { cur: 8 } });
  });

  it('fails loudly when a step is missing', () => {
    expect(() => runMigrations({ schemaVersion: 1 }, 2, {})).toThrow(/Manca la migrazione/);
  });
});

describe('history', () => {
  it('keeps the newest entries, capped at the limit', () => {
    let h: RollRecord[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = addToHistory(h, record(i));
    expect(h).toHaveLength(HISTORY_LIMIT);
    expect(h[0]!.id).toBe(`r${HISTORY_LIMIT + 4}`);
  });
});

describe('export and import', () => {
  it('round-trips with no loss', () => {
    const c = createCharacter('Brann');
    c.hp = { cur: 3, max: 27, temp: 4 };
    c.deathSaves = { successes: 1, failures: 2 };
    c.rollMode = 'disadvantage';
    c.history = [record(1), record(2)];
    c.sheet.classes = [{ name: 'Chierico', subclass: 'Dominio della guerra', level: 4 }];
    c.sheet.abilities.wis = 17;
    c.sheet.skills.insight = { prof: 2, bonus: 1 };
    c.sheet.speedM = 7.5;
    c.sheet.conditions = ['poisoned'];
    c.sheet.attacks = [
      {
        id: 'a1',
        name: 'Martello da guerra',
        ability: 'str',
        proficient: true,
        bonus: 1,
        damage: '1d8',
        addAbilityToDamage: true,
        damageBonus: 0,
        damageType: 'contundenti',
        notes: 'Versatile (1d10)',
      },
    ];
    c.sheet.features = [{ id: 'f1', name: 'Incanalare divinità', source: 'Chierico', text: '…', uses: { cur: 0, max: 1, reset: 'short' } }];
    expect(importCharacter(exportCharacter(c))).toEqual(c);
  });

  it('explains what is wrong with a bad file', () => {
    expect(() => importCharacter('{')).toThrow(/JSON valido/);
    expect(() => importCharacter('{"kind":"other"}')).toThrow(/non è un’esportazione/);
  });
});
