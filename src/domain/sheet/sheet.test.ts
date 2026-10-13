import { describe, expect, it } from 'vitest';
import {
  abilityMod,
  attackBonus,
  attackFormula,
  classSummary,
  d20Formula,
  damageFormula,
  defaultSheet,
  initiative,
  longRestSheet,
  passivePerception,
  proficiencyBonus,
  sanitizeSheet,
  saveBonus,
  shortRest,
  skillBonus,
  totalLevel,
  type Attack,
  type Sheet,
} from './sheet';

let counter = 0;
const newId = () => `id${++counter}`;

/** A level 5 fighter: STR 16, DEX 12, WIS 13, Athletics and Perception proficient. */
function fighter(): Sheet {
  const s = defaultSheet();
  s.classes = [{ name: 'Guerriero', subclass: 'Campione', level: 5 }];
  s.abilities = { ...s.abilities, str: 16, dex: 12, con: 15, wis: 13 };
  s.saves.str = { proficient: true, bonus: 0 };
  s.saves.con = { proficient: true, bonus: 1 };
  s.skills.athletics = { prof: 1, bonus: 0 };
  s.skills.perception = { prof: 1, bonus: 0 };
  return s;
}

function axe(patch: Partial<Attack> = {}): Attack {
  return {
    id: 'a1',
    name: 'Ascia bipenne',
    ability: 'str',
    proficient: true,
    bonus: 0,
    damage: '1d12',
    addAbilityToDamage: true,
    damageBonus: 0,
    damageType: 'taglienti',
    notes: '',
    ...patch,
  };
}

describe('ability modifiers and proficiency', () => {
  it('rounds the modifier down', () => {
    expect([1, 8, 9, 10, 11, 12, 15, 20, 30].map(abilityMod)).toEqual([-5, -1, -1, 0, 0, 1, 2, 5, 10]);
  });

  it('follows the proficiency table', () => {
    expect([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(proficiencyBonus)).toEqual([2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });

  it('sums multiclass levels, clamped to 1..20', () => {
    expect(totalLevel([{ name: 'Mago', subclass: '', level: 3 }, { name: 'Chierico', subclass: '', level: 1 }])).toBe(4);
    expect(totalLevel([{ name: 'A', subclass: '', level: 15 }, { name: 'B', subclass: '', level: 10 }])).toBe(20);
  });
});

describe('derived values', () => {
  it('computes saving throws with proficiency and extra bonus', () => {
    const s = fighter();
    expect(saveBonus(s, 'str')).toBe(6);
    expect(saveBonus(s, 'con')).toBe(6); // +2 COS, +3 competenza, +1 oggetto
    expect(saveBonus(s, 'dex')).toBe(1);
  });

  it('computes skills with half proficiency rounded down and expertise', () => {
    const s = fighter();
    expect(skillBonus(s, 'athletics')).toBe(6);
    s.skills.stealth = { prof: 0.5, bonus: 0 };
    expect(skillBonus(s, 'stealth')).toBe(2); // +1 DES, ⌊3/2⌋
    s.skills.athletics = { prof: 2, bonus: 0 };
    expect(skillBonus(s, 'athletics')).toBe(9);
  });

  it('computes passive Perception and initiative', () => {
    const s = fighter();
    expect(passivePerception(s)).toBe(14);
    s.initiativeBonus = 5;
    expect(initiative(s)).toBe(6);
  });
});

describe('attacks', () => {
  it('builds the attack roll', () => {
    const s = fighter();
    expect(attackBonus(s, axe())).toBe(6);
    expect(attackFormula(s, axe({ bonus: 1 }))).toBe('1d20+7');
    expect(attackFormula(s, axe({ ability: 'none', proficient: false }))).toBe('1d20');
    s.abilities.str = 6;
    expect(attackFormula(s, axe({ proficient: false }))).toBe('1d20-2');
  });

  it('builds damage, doubling only the dice on a critical hit', () => {
    const s = fighter();
    expect(damageFormula(s, axe())).toBe('1d12+3');
    expect(damageFormula(s, axe({ damage: '2d6+1d4', damageBonus: 1 }), true)).toBe('4d6+2d4+4');
    expect(damageFormula(s, axe({ addAbilityToDamage: false }))).toBe('1d12');
    expect(damageFormula(s, axe({ damage: '' }))).toBeNull();
  });

  it('describes classes', () => {
    expect(classSummary([{ name: '', subclass: '', level: 1 }])).toBe('Livello 1');
    expect(
      classSummary([{ name: 'Mago', subclass: '', level: 3 }, { name: 'Chierico ', subclass: '', level: 1 }]),
    ).toBe('Mago 3 / Chierico 1');
  });

  it('formats a plain d20 with a modifier', () => {
    expect(d20Formula(0)).toBe('1d20');
    expect(d20Formula(-3)).toBe('1d20-3');
  });
});

describe('rests', () => {
  function withFeatures(): Sheet {
    const s = fighter();
    s.exhaustion = 2;
    s.features = [
      { id: 'f1', name: 'Recuperare energie', source: 'Guerriero', text: '', uses: { cur: 0, max: 1, reset: 'short' } },
      { id: 'f2', name: 'Indomito', source: 'Guerriero', text: '', uses: { cur: 0, max: 1, reset: 'long' } },
      { id: 'f3', name: 'Stile di combattimento', source: 'Guerriero', text: '', uses: null },
    ];
    return s;
  }

  it('a short rest restores only short-rest uses', () => {
    const r = shortRest(withFeatures());
    expect(r.restored).toEqual(['Recuperare energie']);
    expect(r.sheet.features.map((f) => f.uses?.cur)).toEqual([1, 0, undefined]);
    expect(r.sheet.exhaustion).toBe(2);
  });

  it('a long rest restores every use and removes one exhaustion level', () => {
    const r = longRestSheet(withFeatures());
    expect(r.restored).toEqual(['Recuperare energie', 'Indomito']);
    expect(r.sheet.exhaustion).toBe(1);
  });
});

describe('sanitizeSheet', () => {
  it('fills a missing sheet with the defaults', () => {
    expect(sanitizeSheet(undefined, newId)).toEqual(defaultSheet());
  });

  it('keeps a valid sheet unchanged', () => {
    const s = fighter();
    s.attacks = [axe()];
    s.conditions = ['poisoned', 'prone'];
    s.features = [{ id: 'f1', name: 'Secondo attacco', source: '', text: 'Due attacchi', uses: null }];
    expect(sanitizeSheet(JSON.parse(JSON.stringify(s)), newId)).toEqual(s);
  });

  it('clamps and repairs untrusted values', () => {
    const s = sanitizeSheet(
      {
        classes: [{ name: 'Ladro', level: 99 }],
        abilities: { str: 50, dex: -4, con: 'x' },
        skills: { stealth: { prof: 3 }, arcana: { prof: 0.5, bonus: 1000 } },
        ac: -1,
        speedM: 7.54,
        attacks: [{ name: '', ability: 'luck', damage: 'banana' }],
        features: [{ name: 'Ispirazione bardica', uses: { cur: 9, max: 3, reset: 'weekly' } }],
        conditions: ['prone', 'cursed', 'blinded', 'prone'],
        exhaustion: 9,
        languages: ['Elfico', '', 3],
      },
      newId,
    );
    expect(s.classes).toEqual([{ name: 'Ladro', subclass: '', level: 20 }]);
    expect(s.abilities).toMatchObject({ str: 30, dex: 1, con: 10 });
    expect(s.skills.stealth.prof).toBe(0);
    expect(s.skills.arcana).toEqual({ prof: 0.5, bonus: 50 });
    expect(s.ac).toBe(0);
    expect(s.speedM).toBe(7.5);
    expect(s.attacks[0]).toMatchObject({ name: 'Attacco', ability: 'str', damage: '' });
    expect(s.features[0]!.uses).toEqual({ cur: 3, max: 3, reset: 'long' });
    expect(s.conditions).toEqual(['blinded', 'prone']);
    expect(s.exhaustion).toBe(6);
    expect(s.languages).toEqual(['Elfico']);
  });

  it('stores damage dice in canonical form', () => {
    const s = sanitizeSheet({ attacks: [{ name: 'Pugnale', damage: ' D4 ' }] }, newId);
    expect(s.attacks[0]!.damage).toBe('1d4');
  });
});
