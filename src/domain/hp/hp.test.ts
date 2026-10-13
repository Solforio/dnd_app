import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  applyDeathSave,
  applyHealing,
  canRollDeathSave,
  editHp,
  gainTempHp,
  lifeState,
  longRest,
  setDeathSaves,
  type Vitals,
} from './hp';

function vitals(cur: number, max: number, temp = 0, successes = 0, failures = 0): Vitals {
  return {
    hp: { cur, max, temp },
    deathSaves: { successes, failures } as Vitals['deathSaves'],
  };
}

describe('damage', () => {
  it('consumes temporary HP first and explains it', () => {
    const r = applyDamage(vitals(20, 20, 5), 8);
    expect(r.vitals.hp).toEqual({ cur: 17, max: 20, temp: 0 });
    expect(r.message).toBe('Subiti 8 danni (5 assorbiti dai PF temporanei): ora hai 17/20 PF.');
  });

  it('can be absorbed entirely by temporary HP', () => {
    expect(applyDamage(vitals(20, 20, 10), 4).vitals.hp).toEqual({ cur: 20, max: 20, temp: 6 });
  });

  it('drops to 0 without instant death when the excess is below max', () => {
    const r = applyDamage(vitals(5, 20), 24);
    expect(r.vitals.hp.cur).toBe(0);
    expect(lifeState(r.vitals)).toBe('dying');
    expect(r.message).toMatch(/0 PF e privo di sensi/);
  });

  it('kills instantly when the excess over 0 is at least max HP', () => {
    const r = applyDamage(vitals(5, 20), 25);
    expect(r.vitals.deathSaves.failures).toBe(3);
    expect(lifeState(r.vitals)).toBe('dead');
    expect(r.message).toMatch(/20 oltre lo zero.*Morte istantanea/);
  });

  it('adds one failure when damaged at 0 HP', () => {
    const r = applyDamage(vitals(0, 20, 0, 1, 1), 3);
    expect(r.vitals.deathSaves).toEqual({ successes: 1, failures: 2 });
    expect(r.message).toMatch(/un fallimento.*\(2\/3\)/);
  });

  it('kills at 0 HP when the damage is at least max HP', () => {
    expect(lifeState(applyDamage(vitals(0, 20), 20).vitals)).toBe('dead');
  });

  it('makes a stable character dying again', () => {
    const r = applyDamage(vitals(0, 20, 0, 3, 0), 2);
    expect(r.vitals.deathSaves).toEqual({ successes: 0, failures: 1 });
    expect(r.message).toMatch(/non sei più stabile/);
  });

  it('does not count a failure when temporary HP absorb all damage at 0 HP', () => {
    expect(applyDamage(vitals(0, 20, 5, 0, 1), 3).vitals.deathSaves.failures).toBe(1);
  });

  it('third failure from damage at 0 HP kills', () => {
    expect(lifeState(applyDamage(vitals(0, 20, 0, 0, 2), 1).vitals)).toBe('dead');
  });
});

describe('healing', () => {
  it('never exceeds the maximum', () => {
    const r = applyHealing(vitals(15, 20), 10);
    expect(r.vitals.hp.cur).toBe(20);
    expect(r.message).toBe('Curati 5 PF: ora hai 20/20 PF (5 oltre il massimo persi).');
  });

  it('from 0 HP resets the death saves', () => {
    const r = applyHealing(vitals(0, 20, 0, 2, 2), 3);
    expect(r.vitals.hp.cur).toBe(3);
    expect(r.vitals.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it('does nothing to a dead character', () => {
    const v = vitals(0, 20, 0, 0, 3);
    expect(applyHealing(v, 5).vitals).toBe(v);
  });
});

describe('temporary HP', () => {
  it('replace the old value only if higher', () => {
    expect(gainTempHp(vitals(10, 10, 5), 8).vitals.hp.temp).toBe(8);
    const r = gainTempHp(vitals(10, 10, 5), 3);
    expect(r.vitals.hp.temp).toBe(5);
    expect(r.message).toMatch(/non si sommano/);
  });
});

describe('long rest', () => {
  it('restores HP, clears temporary HP and death saves', () => {
    const r = longRest(vitals(0, 30, 4, 1, 2));
    expect(r.vitals).toEqual(vitals(30, 30, 0, 0, 0));
  });
});

describe('direct edits', () => {
  it('clamps current HP to the new maximum', () => {
    expect(editHp(vitals(20, 20), { max: 12 }).vitals.hp).toEqual({ cur: 12, max: 12, temp: 0 });
  });

  it('clamps negative and invalid values', () => {
    expect(editHp(vitals(5, 20), { cur: -4, temp: Number.NaN }).vitals.hp).toEqual({ cur: 0, max: 20, temp: 0 });
    expect(editHp(vitals(5, 20), { max: 0 }).vitals.hp.max).toBe(1);
  });

  it('resets death saves when lifted above 0', () => {
    expect(editHp(vitals(0, 20, 0, 1, 2), { cur: 4 }).vitals.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it('sets death-save toggles directly', () => {
    const r = setDeathSaves(vitals(0, 20), { successes: 3, failures: 1 });
    expect(lifeState(r.vitals)).toBe('stable');
    expect(r.message).toMatch(/stabile/);
  });
});

describe('death saves', () => {
  const dying = vitals(0, 20, 0, 1, 1);

  it('is only possible while dying', () => {
    expect(canRollDeathSave(vitals(1, 20))).toBe(false);
    expect(canRollDeathSave(dying)).toBe(true);
    expect(canRollDeathSave(vitals(0, 20, 0, 3, 0))).toBe(false);
    expect(canRollDeathSave(vitals(0, 20, 0, 0, 3))).toBe(false);
    expect(applyDeathSave(vitals(5, 20), 15).vitals).toEqual(vitals(5, 20));
  });

  it('natural 20 brings the character back to 1 HP', () => {
    expect(applyDeathSave(dying, 20).vitals).toEqual(vitals(1, 20, 0, 0, 0));
  });

  it('natural 1 counts two failures', () => {
    expect(applyDeathSave(dying, 1).vitals.deathSaves).toEqual({ successes: 1, failures: 3 });
  });

  it('10 or more is a success, below 10 a failure', () => {
    expect(applyDeathSave(dying, 10).vitals.deathSaves).toEqual({ successes: 2, failures: 1 });
    expect(applyDeathSave(dying, 9).vitals.deathSaves).toEqual({ successes: 1, failures: 2 });
  });

  it('three successes stabilise, three failures kill', () => {
    const s = applyDeathSave(vitals(0, 20, 0, 2, 0), 12);
    expect(lifeState(s.vitals)).toBe('stable');
    expect(s.message).toMatch(/stabile/);
    const f = applyDeathSave(vitals(0, 20, 0, 0, 2), 4);
    expect(lifeState(f.vitals)).toBe('dead');
    expect(f.message).toMatch(/morto/);
  });
});
