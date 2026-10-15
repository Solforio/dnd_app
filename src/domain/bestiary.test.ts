import { describe, expect, it } from 'vitest';
import monstersJson from '../../public/srd/monsters.json?raw';
import {
  completeness,
  CR_STEPS,
  entryNumber,
  filterMonsters,
  formatCr,
  NO_FILTER,
  revealableSections,
  REVEAL_SECTIONS,
  sanitizeEntry,
  sanitizeFilter,
  sanitizeMonsterCatalogue,
  toggleReveal,
  typeKey,
  typeLabel,
  type BestiaryEntry,
  type Monster,
} from './bestiary';

const catalogue = sanitizeMonsterCatalogue(JSON.parse(monstersJson));
const monster = (id: string): Monster => {
  const m = catalogue.find((x) => x.id === id);
  if (!m) throw new Error(`no monster ${id}`);
  return m;
};

describe('the catalogue', () => {
  it('is the SRD list: 334 monsters, each with a stat block that makes sense', () => {
    expect(catalogue).toHaveLength(334);
    expect(catalogue.every((m) => m.ac > 0 && m.hp > 0 && m.abilities.length === 6 && m.actions.length + m.traits.length > 0)).toBe(true);
    expect(new Set(catalogue.map((m) => m.id)).size).toBe(334);
    const dragon = monster('adult-red-dragon');
    expect(dragon).toMatchObject({ ac: 19, hp: 256, cr: 17, xp: 18000, size: 'Huge', type: 'dragon' });
    expect(dragon.legendary?.length).toBeGreaterThan(0);
    expect(dragon.traits[0]!.name).toBe('Legendary Resistance (3/Day)');
    expect(dragon.actions.find((a) => a.name.startsWith('Fire Breath'))?.name).toBe('Fire Breath (Recharge 5-6)');
  });

  it('keeps optional lines only when there is something to say', () => {
    const goblin = monster('goblin');
    expect(goblin.immunities).toBeUndefined();
    expect(goblin.skills).toBe('Stealth +6');
    expect(monster('adult-red-dragon').immunities).toBe('fire');
  });

  it('drops entries without an id or a name and clamps the rest', () => {
    const odd = sanitizeMonsterCatalogue({ monsters: [{ id: 'a' }, { name: 'B' }, { id: 'c', name: 'C', ac: 999, cr: 99, abilities: [1] }] });
    expect(odd).toHaveLength(1);
    expect(odd[0]).toMatchObject({ ac: 40, cr: 30 });
    expect(odd[0]!.abilities).toHaveLength(6);
    expect(sanitizeMonsterCatalogue(null)).toEqual([]);
  });
});

describe('reading the catalogue', () => {
  it('writes challenge ratings as a stat block does', () => {
    expect([0, 0.125, 0.25, 0.5, 1, 17].map(formatCr)).toEqual(['0', '1/8', '1/4', '1/2', '1', '17']);
    expect(CR_STEPS[0]).toBe(0);
    expect(CR_STEPS.at(-1)).toBe(30);
  });

  it('groups every swarm and gives Italian names to the types', () => {
    expect(typeKey('swarm of Tiny beasts')).toBe('swarm');
    expect(typeLabel('swarm of Tiny beasts')).toBe('Sciame');
    expect(typeLabel('dragon')).toBe('Drago');
    expect(typeLabel('something new')).toBe('something new');
  });

  it('filters by name, type, size and challenge rating together', () => {
    expect(filterMonsters(catalogue, { ...NO_FILTER, query: 'DRAGON' }).length).toBeGreaterThan(20);
    expect(filterMonsters(catalogue, NO_FILTER)).toHaveLength(334);
    const smallUndead = filterMonsters(catalogue, { ...NO_FILTER, type: 'undead', size: 'Medium', crMax: 3 });
    expect(smallUndead.length).toBeGreaterThan(3);
    expect(smallUndead.every((m) => m.type === 'undead' && m.size === 'Medium' && m.cr <= 3)).toBe(true);
    expect(filterMonsters(catalogue, { ...NO_FILTER, type: 'swarm' }).every((m) => m.type.startsWith('swarm'))).toBe(true);
    expect(filterMonsters(catalogue, { ...NO_FILTER, query: 'zzzz' })).toEqual([]);
    const high = filterMonsters(catalogue, { ...NO_FILTER, crMin: 20 });
    expect(high.every((m) => m.cr >= 20)).toBe(true);
  });
});

const entry = (patch: Partial<BestiaryEntry> = {}): BestiaryEntry => ({
  id: 'e1',
  name: 'Il drago rosso',
  srdId: 'adult-red-dragon',
  creatureType: '',
  place: '',
  notes: '',
  revealed: [],
  custom: { ac: null, hp: '', speed: '' },
  createdBy: 'u1',
  createdByName: 'alice',
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

describe('the party bestiary entries', () => {
  it('reads a stored document safely', () => {
    const e = sanitizeEntry('x', { name: 'Gnoll', srdId: 'gnoll', revealed: ['ac', 'zzz', 'actions', 'ac'], notes: 'n'.repeat(5000), custom: { ac: 99, hp: 'molti' } });
    expect(e.id).toBe('x');
    expect(e.revealed).toEqual(['ac', 'actions']);
    expect(e.notes).toHaveLength(2000);
    expect(e.custom).toEqual({ ac: 40, hp: 'molti', speed: '' });
    expect(sanitizeEntry('y', null)).toMatchObject({ name: 'Creatura senza nome', srdId: null, revealed: [] });
  });

  it('offers only the sections that exist for the monster', () => {
    expect(revealableSections(entry(), monster('adult-red-dragon'))).toEqual([...REVEAL_SECTIONS]);
    const goblin = revealableSections(entry({ srdId: 'goblin' }), monster('goblin'));
    expect(goblin).not.toContain('legendary');
    expect(goblin).not.toContain('defenses');
    expect(goblin).toContain('saves');
    expect(revealableSections(entry({ srdId: null }), undefined)).toEqual(['ac', 'hp', 'speed']);
  });

  it('counts how much is known', () => {
    const m = monster('goblin');
    const total = revealableSections(entry({ srdId: 'goblin' }), m).length;
    expect(completeness(entry({ srdId: 'goblin' }), m)).toEqual({ known: 0, total });
    expect(completeness(entry({ srdId: 'goblin', revealed: ['ac', 'hp', 'legendary'] }), m)).toEqual({ known: 2, total });
  });

  it('toggles a section in the canonical order', () => {
    expect(toggleReveal([], 'actions')).toEqual(['actions']);
    expect(toggleReveal(['actions'], 'ac')).toEqual(['ac', 'actions']);
    expect(toggleReveal(['ac', 'actions'], 'ac')).toEqual(['actions']);
  });

  it('numbers a card by its place in the catalogue, nothing for a custom creature', () => {
    expect(entryNumber(entry({ srdId: catalogue[0]!.id }), catalogue)).toBe(1);
    expect(entryNumber(entry({ srdId: catalogue[9]!.id }), catalogue)).toBe(10);
    expect(entryNumber(entry({ srdId: null }), catalogue)).toBeNull();
    expect(entryNumber(entry({ srdId: 'not-there' }), catalogue)).toBeNull();
  });
});

describe('sanitizeFilter', () => {
  it('keeps a valid filter', () => {
    const f = { query: 'gob', type: 'humanoid', size: 'Small', crMin: 0.25, crMax: 5 };
    expect(sanitizeFilter(f)).toEqual(f);
  });

  it('falls back field by field on anything unexpected', () => {
    expect(sanitizeFilter(null)).toEqual(NO_FILTER);
    expect(sanitizeFilter({ query: 5, type: 'nonsense', size: 'Colossal', crMin: 'a', crMax: 999 })).toEqual(NO_FILTER);
  });

  it('never lets the maximum challenge rating sit under the minimum', () => {
    expect(sanitizeFilter({ crMin: 10, crMax: 2 }).crMax).toBe(10);
  });
});
