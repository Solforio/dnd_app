import { describe, expect, it } from 'vitest';
import { CONDITION_EFFECTS, exhaustionEffects, impliedConditions } from './conditionEffects';
import { CONDITIONS } from './rules';

describe('condition effects', () => {
  it('describes every SRD condition', () => {
    for (const c of CONDITIONS) {
      expect(CONDITION_EFFECTS[c].summary.length).toBeGreaterThan(0);
      expect(CONDITION_EFFECTS[c].details.length).toBeGreaterThan(0);
    }
  });

  it('adds up exhaustion effects by level', () => {
    expect(exhaustionEffects(0)).toEqual([]);
    expect(exhaustionEffects(3)).toHaveLength(3);
    expect(exhaustionEffects(6).at(-1)).toBe('Morte.');
    expect(exhaustionEffects(99)).toHaveLength(6);
  });

  it('lists conditions included by others, once, unless already active', () => {
    expect(impliedConditions(['paralyzed', 'stunned'])).toEqual(['incapacitated']);
    expect(impliedConditions(['unconscious'])).toEqual(['incapacitated', 'prone']);
    expect(impliedConditions(['unconscious', 'prone'])).toEqual(['incapacitated']);
    expect(impliedConditions(['poisoned'])).toEqual([]);
  });
});
