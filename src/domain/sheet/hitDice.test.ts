import { describe, expect, it } from 'vitest';
import { averageRoll, hitDieOf, hitDicePools, hpGain, levelUp, recoverHitDice, spendHitDie } from './hitDice';
import { defaultSheet, longRestSheet, sanitizeSheet, shortRest, type ClassEntry, type Sheet } from './sheet';

const cls = (name: string, level: number, extra: Partial<ClassEntry> = {}): ClassEntry => ({
  name,
  subclass: '',
  level,
  hitDie: 0,
  hitDiceUsed: 0,
  ...extra,
});
const sheetOf = (...classes: ClassEntry[]): Sheet => ({ ...defaultSheet(), classes });

describe('hit die', () => {
  it('comes from the SRD class table, in Italian or English, unless set by hand', () => {
    expect(hitDieOf(cls('Barbaro', 1))).toBe(12);
    expect(hitDieOf(cls(' Fighter ', 1))).toBe(10);
    expect(hitDieOf(cls('Chierico', 1))).toBe(8);
    expect(hitDieOf(cls('Mago', 1))).toBe(6);
    expect(hitDieOf(cls('Artefice', 1))).toBe(8);
    expect(hitDieOf(cls('Mago', 1, { hitDie: 12 }))).toBe(12);
  });

  it('gains the die plus CON, at least 1; the average is half the die plus one', () => {
    expect([6, 8, 10, 12].map(averageRoll)).toEqual([4, 5, 6, 7]);
    expect(hpGain(5, 2)).toBe(7);
    expect(hpGain(1, -3)).toBe(1);
  });
});

describe('level up', () => {
  it('raises the chosen class and records the die', () => {
    const s = sheetOf(cls('Mago', 3), cls('Guerriero', 1));
    const next = levelUp(s, 1, 12)!;
    expect(next.classes.map((c) => c.level)).toEqual([3, 2]);
    expect(next.classes[1]!.hitDie).toBe(12);
    expect(next.classes[0]!.hitDie).toBe(0);
  });

  it('refuses beyond level 20 and for an unknown class', () => {
    expect(levelUp(sheetOf(cls('Mago', 20)), 0, 6)).toBeNull();
    expect(levelUp(sheetOf(cls('Mago', 3)), 4, 6)).toBeNull();
  });
});

describe('hit dice pool', () => {
  it('spends one die at a time, per class, and stops at zero', () => {
    let s = sheetOf(cls('Mago', 1), cls('Guerriero', 2));
    s = spendHitDie(spendHitDie(s, 1), 1);
    expect(hitDicePools(s).map((p) => p.left)).toEqual([1, 0]);
    expect(spendHitDie(s, 1)).toBe(s);
  });

  it('recovers half of the total on a long rest (min 1), the biggest dice first', () => {
    const s = sheetOf(cls('Mago', 4, { hitDiceUsed: 4 }), cls('Barbaro', 4, { hitDiceUsed: 4 }));
    const { sheet, recovered } = recoverHitDice(s);
    expect(recovered).toBe(4);
    expect(sheet.classes.map((c) => c.hitDiceUsed)).toEqual([4, 0]);
    expect(recoverHitDice(sheetOf(cls('Mago', 1, { hitDiceUsed: 1 }))).recovered).toBe(1);
    expect(recoverHitDice(sheetOf(cls('Mago', 5))).recovered).toBe(0);
  });

  it('is part of the long rest, not of the short one', () => {
    const s = sheetOf(cls('Mago', 6, { hitDiceUsed: 6 }));
    expect(shortRest(s).sheet.classes[0]!.hitDiceUsed).toBe(6);
    const rested = longRestSheet(s);
    expect(rested.sheet.classes[0]!.hitDiceUsed).toBe(3);
    expect(rested.hitDice).toBe(3);
  });
});

describe('sanitizing', () => {
  it('defaults old classes without the new fields and drops invalid values', () => {
    const old = { classes: [{ name: 'Mago', subclass: '', level: 3 }] };
    expect(sanitizeSheet(old, () => 'x').classes[0]).toMatchObject({ hitDie: 0, hitDiceUsed: 0 });
    const bad = { classes: [{ name: 'Mago', level: 3, hitDie: 7, hitDiceUsed: 99 }] };
    const c = sanitizeSheet(bad, () => 'x').classes[0]!;
    expect(c.hitDie).toBe(0);
    expect(hitDicePools(sheetOf(c))[0]!.left).toBe(0);
  });
});
