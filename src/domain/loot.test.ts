import { describe, expect, it } from 'vitest';
import { defaultInventory, newItem, ITEM_LIMIT, type Inventory } from './inventory';
import {
  addLootToInventory,
  canClaim,
  describeLoot,
  emptyPurse,
  sanitizeLootItem,
  sanitizeTrade,
  sanitizeTreasure,
  splitPurse,
  takeFromInventory,
  tradeStep,
  treasureIsEmpty,
  type LootItem,
  type Trade,
  type Treasure,
} from './loot';

let n = 0;
const id = () => `id${++n}`;
const potion: LootItem = { name: 'Pozione di cura', category: 'consumable', quantity: 2, weightLb: 0.5, valueCp: 5000, notes: '', requiresAttunement: false };
const bag = (patch: Partial<Inventory> = {}): Inventory => ({ ...defaultInventory(), ...patch });

describe('purses and descriptions', () => {
  it('splits coins in equal parts, the rest going one by one to the first', () => {
    expect(splitPurse({ ...emptyPurse(), gp: 100 }, 3).map((p) => p.gp)).toEqual([34, 33, 33]);
    expect(splitPurse({ ...emptyPurse(), gp: 10, sp: 1, cp: 7 }, 4).map((p) => [p.gp, p.sp, p.cp])).toEqual([[3, 1, 2], [3, 0, 2], [2, 0, 2], [2, 0, 1]]);
    expect(splitPurse({ ...emptyPurse(), gp: 5 }, 1)).toEqual([{ ...emptyPurse(), gp: 5 }]);
    const parts = splitPurse({ cp: 13, sp: 9, ep: 2, gp: 101, pp: 5 }, 6);
    expect(parts.reduce((s, p) => s + p.gp, 0)).toBe(101);
    expect(parts.reduce((s, p) => s + p.cp, 0)).toBe(13);
  });

  it('says what a treasure holds in Italian', () => {
    expect(describeLoot({ ...emptyPurse(), gp: 12, sp: 5 }, [potion, { ...potion, name: 'Spada +1', quantity: 1 }])).toBe('12 mo, 5 ma · 2 × Pozione di cura, Spada +1');
    expect(describeLoot(emptyPurse(), [])).toBe('niente');
  });

  it('cleans an object that came from another user', () => {
    expect(sanitizeLootItem({ name: '  ', quantity: 99999, weightLb: -3, category: 'zzz' })).toMatchObject({ name: 'Oggetto', quantity: 1000, weightLb: 0, category: 'other' });
  });
});

const treasure = (patch: Partial<Treasure> = {}): Treasure => ({
  ...sanitizeTreasure('t1', { title: 'Bottino', coins: { gp: 10 }, items: [potion] }),
  ...patch,
});

describe('treasure', () => {
  it('reads a stored document safely', () => {
    const t = sanitizeTreasure('x', { title: 'Tesoro del drago', coins: { gp: 'many', pp: 5 }, items: [potion, 7], to: 'u2', status: 'weird' });
    expect(t).toMatchObject({ id: 'x', title: 'Tesoro del drago', to: 'u2', status: 'open', claimedBy: null });
    expect(t.coins).toEqual({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 5 });
    expect(t.items).toHaveLength(2);
    expect(sanitizeTreasure('y', null).to).toBeNull();
  });

  it('knows if it is empty, and who can take it', () => {
    expect(treasureIsEmpty({ coins: emptyPurse(), items: [] })).toBe(true);
    expect(treasureIsEmpty(treasure())).toBe(false);
    expect(canClaim(treasure({ to: null }), 'anyone')).toBe(true);
    expect(canClaim(treasure({ to: 'u2' }), 'u2')).toBe(true);
    expect(canClaim(treasure({ to: 'u2' }), 'u3')).toBe(false);
    expect(canClaim(treasure({ status: 'claimed' }), 'u2')).toBe(false);
  });
});

describe('backpack', () => {
  it('adds coins and objects, stacking an identical object', () => {
    const inv = bag({ items: [newItem('a', { name: 'pozione di cura', category: 'consumable', quantity: 1, weightLb: 0.5, valueCp: 5000 })] });
    const r = addLootToInventory(inv, { ...emptyPurse(), gp: 12 }, [potion, { ...potion, name: 'Corda', category: 'gear', quantity: 1 }], id);
    expect(r.error).toBeNull();
    expect(r.inventory.coins.gp).toBe(12);
    expect(r.inventory.items).toHaveLength(2);
    expect(r.inventory.items[0]).toMatchObject({ id: 'a', quantity: 3 });
    expect(r.inventory.items[1]).toMatchObject({ name: 'Corda', quantity: 1 });
  });

  it('does not stack on a worn object or a container, and refuses when the backpack is full', () => {
    const worn = newItem('w', { name: 'Pozione di cura', category: 'consumable', weightLb: 0.5, valueCp: 5000, equipped: true });
    expect(addLootToInventory(bag({ items: [worn] }), emptyPurse(), [potion], id).inventory.items).toHaveLength(2);
    const full = bag({ items: Array.from({ length: ITEM_LIMIT }, (_, i) => newItem(`i${i}`, { name: `Oggetto ${i}` })) });
    const r = addLootToInventory(full, { ...emptyPurse(), gp: 5 }, [potion], id);
    expect(r.error).toMatch(/pieno/);
    expect(r.inventory).toBe(full);
  });

  it('takes some or all of an object out, and refuses containers and too many', () => {
    const inv = bag({ items: [newItem('p', { name: 'Pozione', quantity: 3, weightLb: 0.5 }), newItem('b', { name: 'Zaino', isContainer: true })] });
    const some = takeFromInventory(inv, 'p', 2);
    expect(some.taken).toMatchObject({ name: 'Pozione', quantity: 2 });
    expect(some.inventory.items.find((i) => i.id === 'p')!.quantity).toBe(1);
    const all = takeFromInventory(inv, 'p', 3);
    expect(all.inventory.items.map((i) => i.id)).toEqual(['b']);
    expect(takeFromInventory(inv, 'p', 4).error).toMatch(/Ne hai 3/);
    expect(takeFromInventory(inv, 'p', 0).error).not.toBeNull();
    expect(takeFromInventory(inv, 'b', 1).error).toMatch(/contenitore/);
    expect(takeFromInventory(inv, 'zzz', 1).error).toMatch(/Non trovo/);
  });

  it('a trade moves an object whole: out of one backpack, into the other', () => {
    const giver = bag({ items: [newItem('p', { name: 'Pozione', quantity: 2, weightLb: 0.5, valueCp: 50 })] });
    const taken = takeFromInventory(giver, 'p', 2);
    const received = addLootToInventory(bag(), emptyPurse(), [taken.taken!], id);
    expect(taken.inventory.items).toEqual([]);
    expect(received.inventory.items[0]).toMatchObject({ name: 'Pozione', quantity: 2, weightLb: 0.5, valueCp: 50 });
  });
});

const trade = (patch: Partial<Trade> = {}): Trade => ({
  ...sanitizeTrade('tr', { from: 'a', fromName: 'alice', to: 'b', toName: 'bob', item: potion, status: 'pending', settled: false, createdAt: 1, updatedAt: 1 }),
  ...patch,
});

describe('trades', () => {
  it('reads a stored offer safely', () => {
    expect(sanitizeTrade('x', { status: 'weird', item: null })).toMatchObject({ status: 'pending', settled: false });
  });

  it('tells each side what to do next', () => {
    expect(tradeStep(trade(), 'b')).toBe('respond');
    expect(tradeStep(trade(), 'a')).toBe('cancel');
    expect(tradeStep(trade(), 'c')).toBeNull();
    expect(tradeStep(trade({ status: 'accepted' }), 'b')).toBe('receive');
    expect(tradeStep(trade({ status: 'accepted' }), 'a')).toBeNull();
    expect(tradeStep(trade({ status: 'declined' }), 'a')).toBe('return');
    expect(tradeStep(trade({ status: 'cancelled' }), 'a')).toBe('return');
    expect(tradeStep(trade({ status: 'declined' }), 'b')).toBeNull();
  });

  it('is finished once settled', () => {
    for (const status of ['accepted', 'declined', 'cancelled'] as const) {
      expect(tradeStep(trade({ status, settled: true }), 'a')).toBeNull();
      expect(tradeStep(trade({ status, settled: true }), 'b')).toBeNull();
    }
  });
});
