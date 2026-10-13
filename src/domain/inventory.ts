import { formatNumber } from './format/number';
import { asBool, asArray, asInt, asOneOf, asRecord, asString } from './schema/sanitize';

/**
 * Inventory and carrying weight. Weights are always stored in pounds and
 * values in copper pieces (integers); the UI converts with 1 lb = 0,5 kg, as
 * in the Italian Player's Handbook.
 */

export const ITEM_LIMIT = 300;
export const ATTUNEMENT_LIMIT = 3;
export const COINS_PER_LB = 50;
export const KG_PER_LB = 0.5;
export const DEFAULT_CAPACITY_PER_STR_LB = 15;
export const CAPACITY_PER_STR = { min: 1, max: 50, step: 0.5 } as const;
const MAX_WEIGHT_LB = 100_000;
const MAX_VALUE_CP = 1_000_000_000;
const MAX_QUANTITY = 100_000;
const MAX_COINS = 100_000_000;

export const CATEGORIES = ['weapon', 'armor', 'gear', 'consumable', 'tool', 'treasure', 'magic', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  weapon: 'Armi',
  armor: 'Armature',
  gear: 'Attrezzatura',
  consumable: 'Consumabili',
  tool: 'Strumenti',
  treasure: 'Tesori',
  magic: 'Oggetti magici',
  other: 'Altro',
};

export const COINS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const;
export type Coin = (typeof COINS)[number];
export const COIN_LABELS: Readonly<Record<Coin, { short: string; long: string }>> = {
  cp: { short: 'mr', long: 'Monete di rame' },
  sp: { short: 'ma', long: 'Monete d’argento' },
  ep: { short: 'me', long: 'Monete di electrum' },
  gp: { short: 'mo', long: 'Monete d’oro' },
  pp: { short: 'mp', long: 'Monete di platino' },
};
/** Value of one coin in copper pieces. */
export const COIN_CP: Readonly<Record<Coin, number>> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

export interface Item {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  /** Per unit, in pounds (two decimals). */
  weightLb: number;
  /** Per unit, in copper pieces. */
  valueCp: number;
  notes: string;
  equipped: boolean;
  requiresAttunement: boolean;
  attuned: boolean;
  isContainer: boolean;
  /** Optional capacity of a container, in pounds. */
  containerCapacityLb: number | null;
  /** Bag of holding and the like: what is inside does not count. */
  weightlessContents: boolean;
  /** The container this item is in; containers themselves are never inside another one. */
  containerId: string | null;
}

export type WeightUnit = 'kg' | 'lb';

export interface InventorySettings {
  weightUnit: WeightUnit;
  capacityPerStrLb: number;
  variantEncumbrance: boolean;
  coinsHaveWeight: boolean;
}

export interface Inventory {
  items: Item[];
  coins: Record<Coin, number>;
  settings: InventorySettings;
}

export function defaultInventory(): Inventory {
  return {
    items: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    settings: {
      weightUnit: 'kg',
      capacityPerStrLb: DEFAULT_CAPACITY_PER_STR_LB,
      variantEncumbrance: false,
      coinsHaveWeight: true,
    },
  };
}

export function newItem(id: string, patch: Partial<Item> = {}): Item {
  return {
    id,
    name: 'Nuovo oggetto',
    category: 'gear',
    quantity: 1,
    weightLb: 0,
    valueCp: 0,
    notes: '',
    equipped: false,
    requiresAttunement: false,
    attuned: false,
    isContainer: false,
    containerCapacityLb: null,
    weightlessContents: false,
    containerId: null,
    ...patch,
  };
}

// --- Sanitizing ---

function asPounds(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(MAX_WEIGHT_LB, Math.max(0, Math.round(n * 100) / 100));
}

/** Clamps the capacity coefficient to 1..50 in steps of 0,5. */
export function clampCapacityPerStr(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_CAPACITY_PER_STR_LB;
  const stepped = Math.round(n / CAPACITY_PER_STR.step) * CAPACITY_PER_STR.step;
  return Math.min(CAPACITY_PER_STR.max, Math.max(CAPACITY_PER_STR.min, stepped));
}

function sanitizeItem(raw: unknown, newId: () => string): Item {
  const i = asRecord(raw);
  const requiresAttunement = asBool(i.requiresAttunement);
  const isContainer = asBool(i.isContainer);
  return {
    id: asString(i.id, 64) || newId(),
    name: asString(i.name, 80) || 'Oggetto',
    category: asOneOf(i.category, CATEGORIES, 'other'),
    quantity: asInt(i.quantity, 0, MAX_QUANTITY, 1),
    weightLb: asPounds(i.weightLb),
    valueCp: asInt(i.valueCp, 0, MAX_VALUE_CP, 0),
    notes: asString(i.notes, 500),
    equipped: asBool(i.equipped),
    requiresAttunement,
    attuned: requiresAttunement && asBool(i.attuned),
    isContainer,
    containerCapacityLb: isContainer && typeof i.containerCapacityLb === 'number' ? asPounds(i.containerCapacityLb) : null,
    weightlessContents: isContainer && asBool(i.weightlessContents),
    containerId: isContainer ? null : asString(i.containerId, 64) || null,
  };
}

export function sanitizeInventory(raw: unknown, newId: () => string): Inventory {
  const inv = asRecord(raw);
  const d = defaultInventory();
  const s = asRecord(inv.settings);
  const coins = asRecord(inv.coins);
  const items = asArray(inv.items, ITEM_LIMIT).map((x) => sanitizeItem(x, newId));

  // Unique ids; items point only at containers that exist; at most 3 attuned (the first ones keep it).
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) item.id = newId();
    seen.add(item.id);
  }
  const containers = new Set(items.filter((i) => i.isContainer).map((i) => i.id));
  let attuned = 0;
  for (const item of items) {
    if (item.containerId && !containers.has(item.containerId)) item.containerId = null;
    if (item.attuned && ++attuned > ATTUNEMENT_LIMIT) item.attuned = false;
  }

  return {
    items,
    coins: Object.fromEntries(COINS.map((c) => [c, asInt(coins[c], 0, MAX_COINS, 0)])) as Record<Coin, number>,
    settings: {
      weightUnit: asOneOf(s.weightUnit, ['kg', 'lb'] as const, d.settings.weightUnit),
      capacityPerStrLb: clampCapacityPerStr(s.capacityPerStrLb),
      variantEncumbrance: asBool(s.variantEncumbrance, d.settings.variantEncumbrance),
      coinsHaveWeight: asBool(s.coinsHaveWeight, d.settings.coinsHaveWeight),
    },
  };
}

// --- Weight ---

export function coinCount(coins: Record<Coin, number>): number {
  return COINS.reduce((sum, c) => sum + coins[c], 0);
}

export function coinsWeightLb(coins: Record<Coin, number>): number {
  return coinCount(coins) / COINS_PER_LB;
}

export function coinsValueCp(coins: Record<Coin, number>): number {
  return COINS.reduce((sum, c) => sum + coins[c] * COIN_CP[c], 0);
}

/** Weight of the items inside a container (whatever its "weightless" flag says). */
export function contentsWeightLb(items: readonly Item[], containerId: string): number {
  return items.filter((i) => i.containerId === containerId).reduce((sum, i) => sum + i.weightLb * i.quantity, 0);
}

/** What the character carries: every item, minus the contents of weightless containers, plus coins if they weigh. */
export function carriedWeightLb(inv: Inventory): number {
  const weightless = new Set(inv.items.filter((i) => i.isContainer && i.weightlessContents).map((i) => i.id));
  const items = inv.items
    .filter((i) => !(i.containerId && weightless.has(i.containerId)))
    .reduce((sum, i) => sum + i.weightLb * i.quantity, 0);
  return items + (inv.settings.coinsHaveWeight ? coinsWeightLb(inv.coins) : 0);
}

export function totalValueCp(inv: Inventory): number {
  return inv.items.reduce((sum, i) => sum + i.valueCp * i.quantity, 0) + coinsValueCp(inv.coins);
}

export function capacityLb(strength: number, settings: InventorySettings): number {
  return strength * settings.capacityPerStrLb;
}

export type Encumbrance = 'normal' | 'encumbered' | 'heavily' | 'over';
export const ENCUMBRANCE_LABELS: Readonly<Record<Encumbrance, string>> = {
  normal: 'Normale',
  encumbered: 'Ingombrato',
  heavily: 'Pesantemente ingombrato',
  over: 'Sovraccarico',
};

/**
 * Above the capacity: over. With the variant rule, above ⅓ of the capacity
 * (STR × 5 with the default 15) encumbered, above ⅔ heavily encumbered.
 */
export function encumbrance(weightLb: number, capacity: number, variant: boolean): Encumbrance {
  if (weightLb > capacity) return 'over';
  if (!variant) return 'normal';
  if (weightLb > (capacity * 2) / 3) return 'heavily';
  if (weightLb > capacity / 3) return 'encumbered';
  return 'normal';
}

/** Speed penalty in metres (variant rule: −3 m encumbered, −6 m heavily; the SRD's 10 and 20 ft). */
export function speedPenaltyM(e: Encumbrance, variant: boolean): number {
  if (!variant) return 0;
  if (e === 'encumbered') return 3;
  if (e === 'heavily' || e === 'over') return 6;
  return 0;
}

export function attunedCount(items: readonly Item[]): number {
  return items.filter((i) => i.attuned).length;
}

// --- Units and formatting ---

export function toUnit(lb: number, unit: WeightUnit): number {
  return unit === 'kg' ? lb * KG_PER_LB : lb;
}

export function fromUnit(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value / KG_PER_LB : value;
}

/** "7,5 kg", "15 lb", "0,02 kg". */
export function formatWeight(lb: number, unit: WeightUnit): string {
  return `${formatNumber(toUnit(lb, unit), 2)} ${unit}`;
}

/** Value in gold pieces with up to two decimals: "1.250 mo", "0,5 mo". */
export function formatGp(cp: number): string {
  return `${formatNumber(cp / 100, 2)} mo`;
}
