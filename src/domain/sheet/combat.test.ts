import { describe, expect, it } from 'vitest';
import {
  addEffect,
  concentrationDC,
  defaultCombat,
  dropConcentration,
  durationOf,
  effectFromSpell,
  endCombat,
  endTurn,
  removeEffect,
  sanitizeCombat,
  startCombat,
  type Effect,
} from './combat';
import { defaultSheet, longRestSheet, sanitizeSheet, type Sheet } from './sheet';

const effect = (id: string, remaining: number | null, concentration = false): Effect => ({ id, name: `Effetto ${id}`, remaining, concentration, note: '' });
const fight = (...effects: Effect[]): Sheet => {
  const s = startCombat(defaultSheet());
  return { ...s, combat: { ...s.combat, effects } };
};

describe('starting and ending', () => {
  it('starts at round 1, keeps running effects, and ends clearing them', () => {
    const s = startCombat({ ...defaultSheet(), combat: { ...defaultCombat(), effects: [effect('a', 3)] } });
    expect(s.combat).toMatchObject({ active: true, round: 1 });
    expect(s.combat.effects).toHaveLength(1);
    expect(endCombat(s).combat).toEqual(defaultCombat());
  });

  it('a long rest ends the fight', () => {
    expect(longRestSheet(fight(effect('a', 3))).sheet.combat).toEqual(defaultCombat());
  });
});

describe('end of turn', () => {
  it('advances the round and counts every timed effect down, ending the ones that reach zero', () => {
    const r = endTurn(fight(effect('a', 3), effect('b', 1), effect('c', null)));
    expect(r.sheet.combat.round).toBe(2);
    expect(r.sheet.combat.effects.map((e) => [e.id, e.remaining])).toEqual([['a', 2], ['c', null]]);
    expect(r.expired).toEqual(['Effetto b']);
  });

  it('does nothing outside a combat', () => {
    const s = defaultSheet();
    expect(endTurn(s)).toEqual({ sheet: s, expired: [] });
  });

  it('a 10-round effect lasts exactly ten end-of-turn presses', () => {
    let s = fight(effect('a', 10));
    for (let i = 0; i < 9; i++) s = endTurn(s).sheet;
    expect(s.combat.effects).toHaveLength(1);
    expect(endTurn(s).expired).toEqual(['Effetto a']);
  });
});

describe('effects', () => {
  it('a new concentration effect replaces the old one; other effects stay', () => {
    const base = fight(effect('a', 5, true), effect('b', 5));
    const r = addEffect(base, effect('c', 5, true));
    expect(r.dropped).toBe('Effetto a');
    expect(r.sheet.combat.effects.map((e) => e.id)).toEqual(['b', 'c']);
    expect(addEffect(base, effect('d', 5)).dropped).toBeNull();
  });

  it('refuses effects beyond the limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => effect(String(i), 5));
    expect(addEffect(fight(...many), effect('x', 5)).error).toMatch(/30/);
  });

  it('removes one effect, or all the concentration ones', () => {
    const s = fight(effect('a', 5, true), effect('b', 5));
    expect(removeEffect(s, 'b').combat.effects.map((e) => e.id)).toEqual(['a']);
    const dropped = dropConcentration(s);
    expect(dropped.dropped).toEqual(['Effetto a']);
    expect(dropped.sheet.combat.effects.map((e) => e.id)).toEqual(['b']);
    expect(dropConcentration(removeEffect(s, 'a')).sheet.combat.effects).toHaveLength(1);
  });
});

describe('concentration', () => {
  it('needs a save of 10, or half the damage when that is more', () => {
    expect([1, 19, 20, 21, 40, 41].map(concentrationDC)).toEqual([10, 10, 10, 10, 20, 20]);
  });
});

describe('durations', () => {
  it('counts rounds and minutes (ten rounds each) and leaves long ones to the player', () => {
    expect(durationOf('1 round')).toEqual({ rounds: 1 });
    expect(durationOf('Up to 1 round')).toEqual({ rounds: 1 });
    expect(durationOf('1 minute')).toEqual({ rounds: 10 });
    expect(durationOf('Up to 1 minute')).toEqual({ rounds: 10 });
    expect(durationOf('Up to 10 minutes')).toEqual({ rounds: 100 });
    for (const long of ['Up to 1 hour', '8 hours', '24 hours', '7 days', 'Until dispelled', 'Special']) {
      expect(durationOf(long)).toEqual({ rounds: null });
    }
  });

  it('has no duration for instantaneous spells, so they leave no effect', () => {
    expect(durationOf('Instantaneous')).toBeNull();
  });

  it('turns a spell into an effect with its concentration flag and text', () => {
    const spell = { id: 'bless', name: 'Bless', concentration: true, duration: 'Up to 1 minute' } as Parameters<typeof effectFromSpell>[0];
    expect(effectFromSpell(spell, 'e1')).toEqual({ id: 'e1', name: 'Bless', remaining: 10, concentration: true, note: 'Up to 1 minute', spellId: 'bless' });
    expect(effectFromSpell({ ...spell, duration: 'Instantaneous' }, 'e2')).toBeNull();
  });
});

describe('sanitizing', () => {
  it('defaults old sheets and cleans junk', () => {
    expect(sanitizeSheet({}, () => 'x').combat).toEqual(defaultCombat());
    const c = sanitizeCombat({ active: true, round: -4, effects: [{ name: 'X', remaining: 0, concentration: 'yes' }, 5] }, () => 'id');
    expect(c.round).toBe(1);
    expect(c.effects).toHaveLength(2);
    expect(c.effects[0]).toMatchObject({ id: 'id', name: 'X', remaining: 1, concentration: false });
    expect(sanitizeCombat({ active: false, round: 7 }, () => 'id').round).toBe(0);
  });
});
