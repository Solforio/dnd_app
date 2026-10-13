import { describe, expect, it } from 'vitest';
import {
  attunedCount,
  capacityLb,
  carriedWeightLb,
  clampCapacityPerStr,
  coinsValueCp,
  coinsWeightLb,
  contentsWeightLb,
  defaultInventory,
  encumbrance,
  formatGp,
  formatWeight,
  fromUnit,
  newItem,
  sanitizeInventory,
  speedPenaltyM,
  totalValueCp,
  type Inventory,
} from './inventory';

let n = 0;
const newId = () => `gen${++n}`;

function pack(): Inventory {
  const inv = defaultInventory();
  inv.items = [
    newItem('sword', { name: 'Spada lunga', category: 'weapon', weightLb: 3, valueCp: 1500, equipped: true }),
    newItem('bag', { name: 'Zaino', isContainer: true, weightLb: 5, valueCp: 200 }),
    newItem('rope', { name: 'Corda', weightLb: 10, valueCp: 100, containerId: 'bag' }),
    newItem('rations', { name: 'Razioni', category: 'consumable', quantity: 5, weightLb: 2, valueCp: 50, containerId: 'bag' }),
    newItem('holding', { name: 'Borsa conservante', isContainer: true, weightlessContents: true, weightLb: 15 }),
    newItem('gold-bar', { name: 'Lingotto', category: 'treasure', weightLb: 2, valueCp: 5000, containerId: 'holding' }),
  ];
  inv.coins = { cp: 0, sp: 20, ep: 0, gp: 75, pp: 5 };
  return inv;
}

describe('weight', () => {
  it('sums items by quantity, skips weightless contents, adds coins at 50 per lb', () => {
    const inv = pack();
    // 3 + 5 + 10 + 10 + 15 = 43 lb of items, 100 coins = 2 lb
    expect(coinsWeightLb(inv.coins)).toBe(2);
    expect(carriedWeightLb(inv)).toBe(45);
    expect(contentsWeightLb(inv.items, 'bag')).toBe(20);
    expect(contentsWeightLb(inv.items, 'holding')).toBe(2);
  });

  it('lets coins weigh nothing when the option is off', () => {
    const inv = pack();
    inv.settings.coinsHaveWeight = false;
    expect(carriedWeightLb(inv)).toBe(43);
  });

  it('computes capacity and encumbrance (variant thresholds at ⅓ and ⅔)', () => {
    const cap = capacityLb(10, defaultInventory().settings); // 150 lb
    expect(cap).toBe(150);
    expect(encumbrance(50, cap, true)).toBe('normal');
    expect(encumbrance(51, cap, true)).toBe('encumbered');
    expect(encumbrance(101, cap, true)).toBe('heavily');
    expect(encumbrance(151, cap, true)).toBe('over');
    expect(encumbrance(140, cap, false)).toBe('normal');
    expect(encumbrance(151, cap, false)).toBe('over');
    expect(speedPenaltyM('encumbered', true)).toBe(3);
    expect(speedPenaltyM('heavily', true)).toBe(6);
    expect(speedPenaltyM('heavily', false)).toBe(0);
  });

  it('clamps the capacity coefficient to 1..50 in steps of 0,5', () => {
    expect([0, 7.3, 7.25, 15, 99, 'x'].map(clampCapacityPerStr)).toEqual([1, 7.5, 7.5, 15, 50, 15]);
  });
});

describe('units and value', () => {
  it('converts with 1 lb = 0,5 kg and formats the Spanish way', () => {
    expect(formatWeight(15, 'kg')).toBe('7,5 kg');
    expect(formatWeight(15, 'lb')).toBe('15 lb');
    expect(formatWeight(2500, 'lb')).toBe('2.500 lb');
    expect(fromUnit(7.5, 'kg')).toBe(15);
  });

  it('values coins and items in gold pieces', () => {
    const inv = pack();
    expect(coinsValueCp(inv.coins)).toBe(200 + 7500 + 5000);
    // items: 1500 + 200 + 100 + 250 + 0 + 5000 = 7050
    expect(totalValueCp(inv)).toBe(7050 + 12700);
    expect(formatGp(125000)).toBe('1.250 mo');
    expect(formatGp(50)).toBe('0,5 mo');
  });
});

describe('sanitizeInventory', () => {
  it('fills a missing inventory with the defaults', () => {
    expect(sanitizeInventory(undefined, newId)).toEqual(defaultInventory());
  });

  it('keeps a valid inventory unchanged', () => {
    const inv = pack();
    expect(sanitizeInventory(JSON.parse(JSON.stringify(inv)), newId)).toEqual(inv);
  });

  it('repairs untrusted data', () => {
    const inv = sanitizeInventory(
      {
        items: [
          { id: 'a', name: 'Anello', requiresAttunement: true, attuned: true },
          { id: 'b', requiresAttunement: true, attuned: true },
          { id: 'c', requiresAttunement: true, attuned: true },
          { id: 'd', requiresAttunement: true, attuned: true },
          { id: 'e', attuned: true },
          { id: 'a', containerId: 'nowhere', weightLb: -5, quantity: 3.7, category: 'spaceship' },
          { id: 'box', isContainer: true, containerId: 'box', containerCapacityLb: 30 },
        ],
        coins: { gp: -3, pp: '12' },
        settings: { weightUnit: 'stone', capacityPerStrLb: 100, coinsHaveWeight: false },
      },
      newId,
    );
    expect(attunedCount(inv.items)).toBe(3);
    expect(inv.items[3]!.attuned).toBe(false);
    expect(inv.items[4]!.attuned).toBe(false); // does not require attunement
    expect(inv.items[5]).toMatchObject({ containerId: null, weightLb: 0, quantity: 3, category: 'other' });
    expect(inv.items[5]!.id).not.toBe('a');
    expect(inv.items[6]).toMatchObject({ containerId: null, containerCapacityLb: 30 });
    expect(inv.coins).toEqual({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 12 });
    expect(inv.settings).toEqual({ weightUnit: 'kg', capacityPerStrLb: 50, variantEncumbrance: false, coinsHaveWeight: false });
  });
});
