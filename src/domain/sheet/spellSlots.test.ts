import { describe, expect, it } from 'vitest';
import { defaultSheet, longRestSheet, sanitizeSheet, shortRest, type ClassEntry, type Sheet } from './sheet';
import {
  casterKindOf,
  casterLevel,
  maxSlots,
  pactLeft,
  pactOf,
  recoverPact,
  recoverSlot,
  setManualMax,
  setManualSlots,
  slotRows,
  spendPact,
  spendSlot,
} from './spellSlots';

const cls = (name: string, level: number, subclass = ''): ClassEntry => ({ name, subclass, level, hitDie: 0, hitDiceUsed: 0 });
const sheetOf = (...classes: ClassEntry[]): Sheet => ({ ...defaultSheet(), classes });

describe('who casts and how', () => {
  it('knows the SRD casters by Italian or English name, and the third casters by subclass', () => {
    expect(casterKindOf(cls('Mago', 1))).toBe('full');
    expect(casterKindOf(cls(' Cleric ', 1))).toBe('full');
    expect(casterKindOf(cls('Paladino', 1))).toBe('half');
    expect(casterKindOf(cls('Warlock', 1))).toBe('pact');
    expect(casterKindOf(cls('Guerriero', 3, 'Cavaliere Mistico'))).toBe('third');
    expect(casterKindOf(cls('Rogue', 3, 'Arcane Trickster'))).toBe('third');
    expect(casterKindOf(cls('Guerriero', 3, 'Campione'))).toBeNull();
    expect(casterKindOf(cls('Barbaro', 3))).toBeNull();
  });
});

describe('slots from the class levels', () => {
  it('follows the full caster table', () => {
    expect(maxSlots(sheetOf(cls('Mago', 1)))).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(maxSlots(sheetOf(cls('Mago', 5)))).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(maxSlots(sheetOf(cls('Stregone', 20)))).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  });

  it('gives a single half or third caster the slots of their own table', () => {
    expect(maxSlots(sheetOf(cls('Paladino', 1)))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(maxSlots(sheetOf(cls('Paladino', 2)))).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(maxSlots(sheetOf(cls('Ranger', 5)))).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(maxSlots(sheetOf(cls('Paladino', 19)))).toEqual([4, 3, 3, 3, 2, 0, 0, 0, 0]);
    expect(maxSlots(sheetOf(cls('Guerriero', 3, 'Cavaliere Mistico')))).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(maxSlots(sheetOf(cls('Guerriero', 7, 'Eldritch Knight')))).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('adds the levels of several casting classes, halves and thirds rounded down', () => {
    // Wizard 3 + Paladin 4 (counts 2): caster level 5.
    expect(casterLevel([cls('Mago', 3), cls('Paladino', 4)])).toBe(5);
    expect(maxSlots(sheetOf(cls('Mago', 3), cls('Paladino', 4)))).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    // Cleric 2 + Ranger 3 (counts 1): caster level 3.
    expect(casterLevel([cls('Chierico', 2), cls('Ranger', 3)])).toBe(3);
    // Half levels are added first, then rounded down: Paladin 1 + Ranger 2 is 3 half levels, so 1.
    expect(casterLevel([cls('Paladino', 1), cls('Ranger', 2)])).toBe(1);
    // A single casting class next to a non-caster keeps its own table: Paladin 3 / Fighter 2.
    expect(casterLevel([cls('Paladino', 3), cls('Guerriero', 2)])).toBe(2);
  });

  it('gives nothing to non-casters, and keeps the warlock out of the regular slots', () => {
    expect(maxSlots(sheetOf(cls('Barbaro', 8)))).toEqual(Array(9).fill(0));
    expect(maxSlots(sheetOf(cls('Warlock', 5)))).toEqual(Array(9).fill(0));
    expect(casterLevel([cls('Mago', 4), cls('Warlock', 5)])).toBe(4);
  });
});

describe('pact magic', () => {
  it('has few slots of one level, growing with the warlock level', () => {
    expect(pactOf([cls('Warlock', 1)])).toEqual({ count: 1, level: 1 });
    expect(pactOf([cls('Warlock', 5)])).toEqual({ count: 2, level: 3 });
    expect(pactOf([cls('Warlock', 11)])).toEqual({ count: 3, level: 5 });
    expect(pactOf([cls('Warlock', 17)])).toEqual({ count: 4, level: 5 });
    expect(pactOf([cls('Mago', 5)])).toBeNull();
  });
});

describe('spending and recovering', () => {
  it('spends slots up to the maximum and gives them back one at a time', () => {
    let s = sheetOf(cls('Mago', 3)); // 4 first level, 2 second level
    for (let i = 0; i < 6; i++) s = spendSlot(s, 1);
    expect(slotRows(s)).toEqual([
      { level: 1, max: 4, left: 0 },
      { level: 2, max: 2, left: 2 },
    ]);
    s = recoverSlot(recoverSlot(s, 1), 1);
    expect(slotRows(s)[0]!.left).toBe(2);
    expect(spendSlot(s, 5)).toBe(s); // no 5th level slots
    expect(recoverSlot(sheetOf(cls('Mago', 3)), 1).spellcasting.slotsUsed[0]).toBe(0);
  });

  it('spends and recovers pact slots', () => {
    let s = sheetOf(cls('Warlock', 5));
    s = spendPact(spendPact(spendPact(s)));
    expect(pactLeft(s)!.left).toBe(0);
    expect(pactLeft(recoverPact(s))!.left).toBe(1);
    expect(pactLeft(sheetOf(cls('Mago', 5)))).toBeNull();
  });
});

describe('rests', () => {
  it('a short rest restores only pact slots, a long rest everything', () => {
    let s = sheetOf(cls('Mago', 3), cls('Warlock', 2));
    s = spendPact(spendSlot(spendSlot(s, 1), 2));
    const short = shortRest(s);
    expect(short.restored).toEqual(['Slot del Patto']);
    expect(short.sheet.spellcasting.pactUsed).toBe(0);
    expect(slotRows(short.sheet).map((r) => r.left)).toEqual([3, 1]);
    const long = longRestSheet(s);
    expect(long.restored).toEqual(['Slot del Patto', 'Slot incantesimo']);
    expect(slotRows(long.sheet).map((r) => r.left)).toEqual([4, 2]);
  });

  it('says nothing when nothing was spent', () => {
    expect(longRestSheet(sheetOf(cls('Mago', 3))).restored).toEqual([]);
    expect(shortRest(sheetOf(cls('Mago', 3))).restored).toEqual([]);
  });
});

describe('hand-set slots', () => {
  it('replace the class table until switched back, and are clamped to 0-9', () => {
    let s = setManualSlots(sheetOf(cls('Barbaro', 3)), true);
    s = setManualMax(setManualMax(s, 1, 3), 2, 99);
    expect(maxSlots(s)).toEqual([3, 9, 0, 0, 0, 0, 0, 0, 0]);
    expect(maxSlots(setManualSlots(s, false))).toEqual(Array(9).fill(0));
    // Starting from the class table keeps what the classes gave.
    expect(maxSlots(setManualSlots(sheetOf(cls('Mago', 5)), true))).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    // Setting a maximum while following the classes does nothing.
    const auto = sheetOf(cls('Mago', 5));
    expect(setManualMax(auto, 1, 2)).toBe(auto);
  });
});

describe('sanitizing', () => {
  it('defaults old sheets and clamps junk', () => {
    const old = sanitizeSheet({}, () => 'x').spellcasting;
    expect(old).toEqual({ slotsUsed: Array(9).fill(0), pactUsed: 0, manualMax: null, lists: {}, ignoreLimits: false });
    const junk = sanitizeSheet({ spellcasting: { slotsUsed: [1, 'x', 500], pactUsed: -3, manualMax: [12, 2] } }, () => 'x').spellcasting;
    expect(junk.slotsUsed.slice(0, 3)).toEqual([1, 0, 99]);
    expect(junk.pactUsed).toBe(0);
    expect(junk.manualMax).toEqual([9, 2, 0, 0, 0, 0, 0, 0, 0]);
  });
});
