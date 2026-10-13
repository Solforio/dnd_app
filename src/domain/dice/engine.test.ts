import { describe, expect, it } from 'vitest';
import { rollFormula } from './engine';
import { parseFormula } from './parser';
import { cryptoDie, cryptoRandomBelow } from './rng';
import type { DieRoller, RollMode } from './types';

/** A roller that returns the given values in order, failing if it runs out. */
function scripted(...values: number[]): DieRoller {
  let i = 0;
  return () => {
    const v = values[i++];
    if (v === undefined) throw new Error('scripted roller ran out of values');
    return v;
  };
}

function roll(text: string, mode: RollMode, ...values: number[]) {
  const parsed = parseFormula(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return rollFormula(parsed.formula, mode, scripted(...values));
}

describe('rollFormula', () => {
  it('sums dice and flat terms with signs', () => {
    const r = roll('2d6+1d4-3', 'normal', 5, 2, 4);
    expect(r.total).toBe(5 + 2 + 4 - 3);
    expect(r.terms.map((t) => t.subtotal)).toEqual([7, 4, -3]);
    expect(r.terms[2]).toMatchObject({ sign: -1, flat: 3, dice: [] });
  });

  it('keeps the highest three of 4d6 and marks the dropped die', () => {
    const r = roll('4d6kh3', 'normal', 3, 6, 1, 4);
    expect(r.total).toBe(13);
    expect(r.terms[0]!.dice.map((d) => d.kept)).toEqual([true, true, false, true]);
  });

  it('handles kl, dh and dl', () => {
    expect(roll('3d6kl1', 'normal', 4, 2, 5).total).toBe(2);
    expect(roll('3d6dh1', 'normal', 4, 2, 5).total).toBe(6);
    expect(roll('3d6dl2', 'normal', 4, 2, 5).total).toBe(5);
  });

  it('breaks ties in favour of the earlier die', () => {
    const r = roll('3d6kh1', 'normal', 5, 5, 2);
    expect(r.terms[0]!.dice.map((d) => d.kept)).toEqual([true, false, false]);
  });

  it('applies advantage and disadvantage to every plain 1d20 term', () => {
    const adv = roll('d20+d20+2', 'advantage', 3, 17, 12, 8);
    expect(adv.total).toBe(17 + 12 + 2);
    expect(adv.mode).toBe('advantage');
    expect(adv.terms[0]!.dice).toEqual([
      { sides: 20, value: 3, kept: false },
      { sides: 20, value: 17, kept: true },
    ]);

    const dis = roll('d20+5', 'disadvantage', 3, 17);
    expect(dis.total).toBe(8);
    expect(dis.mode).toBe('disadvantage');
  });

  it('does not apply the mode to 2d20, d20 with a suffix, or other dice', () => {
    expect(roll('2d20', 'advantage', 4, 9).terms[0]!.dice).toHaveLength(2);
    expect(roll('2d20', 'advantage', 4, 9).total).toBe(13);
    expect(roll('1d20kh1', 'advantage', 7).terms[0]!.dice).toHaveLength(1);
    const r = roll('1d8+2', 'advantage', 5);
    expect(r.terms[0]!.dice).toHaveLength(1);
    expect(r.mode).toBe('normal');
  });

  it('flags a crit on a kept natural 20 and a fumble on a kept natural 1', () => {
    expect(roll('d20+5', 'normal', 20)).toMatchObject({ crit: true, fumble: false, total: 25 });
    expect(roll('d20+5', 'normal', 1)).toMatchObject({ crit: false, fumble: true });
    expect(roll('d20', 'advantage', 1, 20)).toMatchObject({ crit: true, fumble: false });
    expect(roll('d20', 'advantage', 20, 1)).toMatchObject({ crit: true, fumble: false });
    // The dropped die never counts.
    expect(roll('d20', 'disadvantage', 20, 5)).toMatchObject({ crit: false, fumble: false });
    expect(roll('2d20kh1', 'normal', 1, 20)).toMatchObject({ crit: true });
  });

  it('ignores 20s and 1s when more than one die is kept, or the die is not a d20', () => {
    expect(roll('2d20', 'normal', 20, 20)).toMatchObject({ crit: false, fumble: false });
    expect(roll('1d100', 'normal', 1)).toMatchObject({ crit: false, fumble: false });
    expect(roll('1d6', 'normal', 1)).toMatchObject({ fumble: false });
  });

  it('lets a crit win over a fumble in the same roll', () => {
    expect(roll('d20+d20', 'normal', 1, 20)).toMatchObject({ crit: true, fumble: false });
  });
});

describe('crypto roller', () => {
  it('stays in range and reaches every face', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = cryptoDie(6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it('rejects invalid bounds', () => {
    expect(() => cryptoRandomBelow(0)).toThrow(RangeError);
    expect(() => cryptoRandomBelow(1.5)).toThrow(RangeError);
  });

  it('is roughly uniform on a d20 (chi-square sanity check)', () => {
    const n = 40_000;
    const counts = new Array<number>(20).fill(0);
    for (let i = 0; i < n; i++) counts[cryptoDie(20) - 1]! += 1;
    const expected = n / 20;
    const chi = counts.reduce((acc, c) => acc + (c - expected) ** 2 / expected, 0);
    // 19 degrees of freedom: p = 0.0001 at about 49.
    expect(chi).toBeLessThan(49);
  });
});
