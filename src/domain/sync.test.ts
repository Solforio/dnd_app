import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import { createDebouncedWriter, deriveSyncStatus, isUntouchedDefault, planUpload } from './sync';

function fakeClock() {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    setTimeout: (fn: () => void, ms: number) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (id: unknown) => void timers.delete(id as number),
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
      }
    },
  };
}

describe('createDebouncedWriter', () => {
  it('writes once, with the latest value, after the quiet period', () => {
    const clock = fakeClock();
    const writes: number[] = [];
    const w = createDebouncedWriter<number>((v) => writes.push(v), 1500, clock);
    w.schedule(1);
    clock.advance(1000);
    w.schedule(2);
    clock.advance(1000);
    w.schedule(3);
    expect(w.pending).toBe(true);
    clock.advance(1499);
    expect(writes).toEqual([]);
    clock.advance(1);
    expect(writes).toEqual([3]);
    expect(w.pending).toBe(false);
  });

  it('flushes immediately and only once', () => {
    const clock = fakeClock();
    const writes: number[] = [];
    const w = createDebouncedWriter<number>((v) => writes.push(v), 1500, clock);
    w.schedule(7);
    w.flush();
    w.flush();
    clock.advance(5000);
    expect(writes).toEqual([7]);
  });

  it('cancel drops the pending value', () => {
    const clock = fakeClock();
    const writes: number[] = [];
    const w = createDebouncedWriter<number>((v) => writes.push(v), 1500, clock);
    w.schedule(7);
    w.cancel();
    clock.advance(5000);
    expect(writes).toEqual([]);
  });
});

describe('deriveSyncStatus', () => {
  const base = { loggedIn: true, online: true, pending: false, error: false };
  it('maps each situation to one status', () => {
    expect(deriveSyncStatus({ ...base, loggedIn: false })).toBe('local');
    expect(deriveSyncStatus(base)).toBe('saved');
    expect(deriveSyncStatus({ ...base, pending: true })).toBe('saving');
    expect(deriveSyncStatus({ ...base, online: false, pending: true })).toBe('offline');
    expect(deriveSyncStatus({ ...base, error: true, online: false })).toBe('error');
  });
});

describe('planUpload', () => {
  it('splits local characters into fresh, identical and conflicting', () => {
    const a = createCharacter('A');
    const b = createCharacter('B');
    const c = createCharacter('C');
    const cloudB = { ...b, updatedAt: b.updatedAt + 1000 }; // same content, other timestamp
    const cloudC = { ...c, name: 'C (cambiato)' };
    const plan = planUpload([a, b, c], [cloudB, cloudC, createCharacter('Solo nel cloud')]);
    expect(plan.fresh).toEqual([a]);
    expect(plan.identical).toEqual([b]);
    expect(plan.conflicts).toEqual([{ local: c, cloud: cloudC }]);
  });
});

describe('isUntouchedDefault', () => {
  it('recognises a character nobody has used', () => {
    const c = createCharacter();
    expect(isUntouchedDefault(c)).toBe(true);
    expect(isUntouchedDefault({ ...c, name: 'Thalia' })).toBe(false);
    expect(isUntouchedDefault({ ...c, hp: { cur: 4, max: 10, temp: 0 } })).toBe(false);
  });
});
