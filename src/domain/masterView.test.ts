import { describe, expect, it } from 'vitest';
import { createCharacter, addToHistory, type RollRecord } from './character';
import { buildMasterView, masterViewKey, readMasterView } from './masterView';
import { defaultSharing, sanitizeSharing } from './party';

const roll = (id: string): RollRecord => ({
  id,
  formula: '1d20',
  mode: 'normal',
  terms: [],
  total: 10,
  crit: false,
  fumble: false,
  at: 1,
});

describe('the sheet shared with the Master', () => {
  it('keeps the whole character but not the roll history or the saved rolls', () => {
    const c = { ...createCharacter('Thorin'), history: addToHistory([], roll('a')) };
    const view = buildMasterView(c);
    expect(view.name).toBe('Thorin');
    expect(view.sheet).toEqual(c.sheet);
    expect(view.inventory).toEqual(c.inventory);
    expect(view.history).toEqual([]);
    expect(view.presets).toEqual([]);
  });

  it('round-trips through the reader', () => {
    const c = createCharacter('Thalia');
    c.hp = { cur: 7, max: 20, temp: 2 };
    const back = readMasterView({ schemaVersion: 1, character: buildMasterView(c), updatedAt: 5 });
    expect(back?.name).toBe('Thalia');
    expect(back?.hp).toEqual({ cur: 7, max: 20, temp: 2 });
    expect(back?.sheet.classes).toEqual(c.sheet.classes);
  });

  it('refuses what cannot be a character', () => {
    expect(readMasterView(null)).toBeNull();
    expect(readMasterView({ character: 'x' })).toBeNull();
    expect(readMasterView({ character: { schemaVersion: 999 } })).toBeNull();
  });

  it('knows when nothing changed, whatever the save time', () => {
    const c = createCharacter('A');
    expect(masterViewKey(buildMasterView(c))).toBe(masterViewKey(buildMasterView({ ...c, updatedAt: c.updatedAt + 1000 })));
    expect(masterViewKey(buildMasterView(c))).not.toBe(masterViewKey(buildMasterView({ ...c, hp: { ...c.hp, cur: 1 } })));
  });
});

describe('sharing the full sheet', () => {
  it('is off by default, and old sharing settings read as off', () => {
    expect(defaultSharing().fullSheet).toBe(false);
    expect(sanitizeSharing({ hp: 'exact', fields: {} }).fullSheet).toBe(false);
    expect(sanitizeSharing({ fullSheet: true }).fullSheet).toBe(true);
  });
});
