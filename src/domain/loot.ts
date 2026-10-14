import { asArray, asBool, asInt, asOneOf, asRecord, asString } from './schema/sanitize';
import { CATEGORIES, COIN_LABELS, COINS, ITEM_LIMIT, newItem, type Category, type Coin, type Inventory } from './inventory';

/**
 * Things that move between characters without the Master or anyone else touching a character they do not own:
 * treasure the DM prepares and a player takes, and items two players trade. In both cases the receiver's own
 * app puts the goods in the receiver's own backpack.
 */

export const LOOT_LIMITS = { items: 20, treasures: 60, title: 80, note: 300, coin: 10_000_000, quantity: 1000, itemName: 80 } as const;
const MAX_COINS = 100_000_000;
const MAX_WEIGHT_LB = 100_000;
const MAX_VALUE_CP = 1_000_000_000;
const MAX_ITEM_QUANTITY = 100_000;

export type Purse = Record<Coin, number>;

export const emptyPurse = (): Purse => ({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });

export function sanitizePurse(raw: unknown): Purse {
  const r = asRecord(raw);
  return Object.fromEntries(COINS.map((c) => [c, asInt(r[c], 0, LOOT_LIMITS.coin, 0)])) as Purse;
}

export const purseIsEmpty = (p: Purse): boolean => COINS.every((c) => p[c] === 0);

/** One kind of object that can be given or traded: the part of a backpack item that travels with it. */
export interface LootItem {
  name: string;
  category: Category;
  quantity: number;
  /** Per unit, in pounds. */
  weightLb: number;
  /** Per unit, in copper pieces. */
  valueCp: number;
  notes: string;
  requiresAttunement: boolean;
}

export function sanitizeLootItem(raw: unknown): LootItem {
  const i = asRecord(raw);
  const pounds = typeof i.weightLb === 'number' && Number.isFinite(i.weightLb) ? i.weightLb : 0;
  return {
    name: asString(i.name, LOOT_LIMITS.itemName).trim() || 'Oggetto',
    category: asOneOf(i.category, CATEGORIES, 'other'),
    quantity: asInt(i.quantity, 1, LOOT_LIMITS.quantity, 1),
    weightLb: Math.min(MAX_WEIGHT_LB, Math.max(0, Math.round(pounds * 100) / 100)),
    valueCp: asInt(i.valueCp, 0, MAX_VALUE_CP, 0),
    notes: asString(i.notes, 200),
    requiresAttunement: asBool(i.requiresAttunement),
  };
}

/** «12 mo, 5 ma · 3 × Pozione di cura, Spada +1». */
export function describeLoot(purse: Purse, items: readonly LootItem[]): string {
  const coins = [...COINS].reverse().filter((c) => purse[c] > 0).map((c) => `${purse[c]} ${COIN_LABELS[c].short}`);
  const things = items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name));
  return [coins.join(', '), things.join(', ')].filter(Boolean).join(' · ') || 'niente';
}

// --- Treasure ---

export type TreasureStatus = 'open' | 'claimed';

export interface Treasure {
  id: string;
  title: string;
  note: string;
  coins: Purse;
  items: LootItem[];
  /** The member it is for, or null when the first one who takes it gets it. */
  to: string | null;
  status: TreasureStatus;
  claimedBy: string | null;
  claimedByName: string;
  claimedAt: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export const TREASURE_SCHEMA_VERSION = 1;

export function sanitizeTreasure(id: string, raw: unknown): Treasure {
  const t = asRecord(raw);
  const big = Number.MAX_SAFE_INTEGER;
  return {
    id,
    title: asString(t.title, LOOT_LIMITS.title) || 'Tesoro',
    note: asString(t.note, LOOT_LIMITS.note),
    coins: sanitizePurse(t.coins),
    items: asArray(t.items, LOOT_LIMITS.items).map(sanitizeLootItem),
    to: typeof t.to === 'string' && t.to !== '' ? asString(t.to, 64) : null,
    status: asOneOf(t.status, ['open', 'claimed'] as const, 'open'),
    claimedBy: typeof t.claimedBy === 'string' && t.claimedBy !== '' ? asString(t.claimedBy, 64) : null,
    claimedByName: asString(t.claimedByName, 60),
    claimedAt: asInt(t.claimedAt, 0, big, 0),
    createdBy: asString(t.createdBy, 64),
    createdAt: asInt(t.createdAt, 0, big, 0),
    updatedAt: asInt(t.updatedAt, 0, big, 0),
  };
}

export const treasureIsEmpty = (t: Pick<Treasure, 'coins' | 'items'>): boolean => purseIsEmpty(t.coins) && t.items.length === 0;

/** Equal parts of a purse for `n` people; what does not divide goes one coin at a time to the first ones. */
export function splitPurse(purse: Purse, n: number): Purse[] {
  const count = Math.max(1, Math.trunc(n));
  return Array.from({ length: count }, (_, i) => {
    return Object.fromEntries(COINS.map((c) => [c, Math.floor(purse[c] / count) + (i < purse[c] % count ? 1 : 0)])) as Purse;
  });
}

/** Whether this member can take the treasure now. */
export const canClaim = (t: Treasure, uid: string): boolean => t.status === 'open' && (t.to === null || t.to === uid);

// --- Moving goods in and out of a backpack ---

export interface InventoryChange {
  inventory: Inventory;
  /** Why nothing changed, in Italian; null when it worked. */
  error: string | null;
}

const sameKind = (a: { name: string; category: Category; weightLb: number; valueCp: number; notes: string }, b: LootItem) =>
  a.name.toLowerCase() === b.name.toLowerCase() && a.category === b.category && a.weightLb === b.weightLb && a.valueCp === b.valueCp && a.notes === b.notes;

/** Adds coins and objects to a backpack; an object like one already there (and not worn or a container) joins its stack. */
export function addLootToInventory(inv: Inventory, purse: Purse, items: readonly LootItem[], newId: () => string): InventoryChange {
  let list = inv.items;
  for (const loot of items) {
    const stack = list.find((i) => !i.isContainer && !i.equipped && !i.attuned && i.containerId === null && sameKind(i, loot));
    if (stack) {
      list = list.map((i) => (i === stack ? { ...i, quantity: Math.min(MAX_ITEM_QUANTITY, i.quantity + loot.quantity) } : i));
      continue;
    }
    if (list.length >= ITEM_LIMIT) return { inventory: inv, error: `Lo zaino è pieno (${ITEM_LIMIT} oggetti): togli qualcosa e riprova.` };
    list = [
      ...list,
      newItem(newId(), {
        name: loot.name,
        category: loot.category,
        quantity: loot.quantity,
        weightLb: loot.weightLb,
        valueCp: loot.valueCp,
        notes: loot.notes,
        requiresAttunement: loot.requiresAttunement,
      }),
    ];
  }
  const coins = Object.fromEntries(COINS.map((c) => [c, Math.min(MAX_COINS, inv.coins[c] + purse[c])])) as Record<Coin, number>;
  return { inventory: { ...inv, items: list, coins }, error: null };
}

export interface Taken {
  inventory: Inventory;
  taken: LootItem | null;
  error: string | null;
}

/** Takes `quantity` of an object out of a backpack (to offer it). Containers are not traded: empty them first. */
export function takeFromInventory(inv: Inventory, itemId: string, quantity: number): Taken {
  const item = inv.items.find((i) => i.id === itemId);
  if (!item) return { inventory: inv, taken: null, error: 'Non trovo l’oggetto nello zaino.' };
  if (item.isContainer) return { inventory: inv, taken: null, error: 'Un contenitore non si scambia: prima svuotalo e scambia gli oggetti.' };
  const qty = Math.trunc(quantity);
  if (qty < 1 || qty > item.quantity) return { inventory: inv, taken: null, error: `Ne hai ${item.quantity}.` };
  const taken: LootItem = sanitizeLootItem({
    name: item.name,
    category: item.category,
    quantity: qty,
    weightLb: item.weightLb,
    valueCp: item.valueCp,
    notes: item.notes,
    requiresAttunement: item.requiresAttunement,
  });
  const items =
    qty === item.quantity
      ? inv.items.filter((i) => i.id !== item.id)
      : inv.items.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity - qty } : i));
  return { inventory: { ...inv, items }, taken, error: null };
}

// --- Trades between members ---

export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export const TRADE_STATUSES: readonly TradeStatus[] = ['pending', 'accepted', 'declined', 'cancelled'];
export const TRADE_SCHEMA_VERSION = 1;
export const TRADE_LIMIT = 30;

/**
 * An offer: the offering player's app takes the object out of their backpack when the offer is made, so it
 * lives in this document until it is accepted (the receiver's app then adds it) or comes back (declined or
 * cancelled: the offering player's app puts it back). `settled` marks that the goods have landed.
 */
export interface Trade {
  id: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  item: LootItem;
  status: TradeStatus;
  settled: boolean;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export function sanitizeTrade(id: string, raw: unknown): Trade {
  const t = asRecord(raw);
  const big = Number.MAX_SAFE_INTEGER;
  return {
    id,
    from: asString(t.from, 64),
    fromName: asString(t.fromName, 60),
    to: asString(t.to, 64),
    toName: asString(t.toName, 60),
    item: sanitizeLootItem(t.item),
    status: asOneOf(t.status, TRADE_STATUSES, 'pending'),
    settled: asBool(t.settled),
    note: asString(t.note, 200),
    createdAt: asInt(t.createdAt, 0, big, 0),
    updatedAt: asInt(t.updatedAt, 0, big, 0),
  };
}

/** What this member's app has to do with a trade next, if anything. */
export type TradeStep = 'respond' | 'cancel' | 'receive' | 'return' | null;

export function tradeStep(t: Trade, uid: string): TradeStep {
  if (t.status === 'pending') return t.to === uid ? 'respond' : t.from === uid ? 'cancel' : null;
  if (t.settled) return null;
  if (t.status === 'accepted' && t.to === uid) return 'receive';
  if ((t.status === 'declined' || t.status === 'cancelled') && t.from === uid) return 'return';
  return null;
}

export const TRADE_STATUS_LABELS: Readonly<Record<TradeStatus, string>> = {
  pending: 'In attesa',
  accepted: 'Accettato',
  declined: 'Rifiutato',
  cancelled: 'Annullato',
};
