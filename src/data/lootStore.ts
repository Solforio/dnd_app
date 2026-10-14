import type { Unsubscribe } from 'firebase/firestore';
import { create } from 'zustand';
import { newId } from '../domain/character';
import {
  addLootToInventory,
  describeLoot,
  emptyPurse,
  LOOT_LIMITS,
  takeFromInventory,
  TRADE_LIMIT,
  tradeStep,
  treasureIsEmpty,
  type LootItem,
  type Purse,
  type Trade,
  type Treasure,
} from '../domain/loot';
import { useCharacterStore } from './characterStore';
import { getFirebase } from './firebase';
import * as repo from './partyRepo';
import { useSession } from './session';

/**
 * Treasure and trades of the party that is open: two listeners while its page is shown. Nothing here changes a
 * character that is not the player's own: the Master prepares treasure and a player's own app takes it; a trade
 * is an offer that the receiver's app turns into an object in the receiver's backpack.
 * Goods always go to, and come from, the backpack of the character that is active on this device.
 */

interface LootState {
  /** null until the listener delivers. */
  treasures: Treasure[] | null;
  trades: Trade[] | null;
  failed: boolean;
  /** What the last treasure step did. */
  notice: string;
  /** What the last automatic trade step did (goods received or returned). */
  tradeNotice: string;
}

export const useLootStore = create<LootState>(() => ({ treasures: null, trades: null, failed: false, notice: '', tradeNotice: '' }));

const OFFLINE = 'Operazione non riuscita: controlla la connessione e riprova.';

function ctx() {
  const fb = getFirebase();
  const s = useSession.getState();
  return fb && s.user && s.phase === 'cloud' ? { db: fb.db, user: s.user } : null;
}

const activeInventory = () => useCharacterStore.getState().character.inventory;
const editInventory = (fn: Parameters<ReturnType<typeof useCharacterStore.getState>['editInventory']>[0]) => useCharacterStore.getState().editInventory(fn);

export function watchLoot(pid: string): Unsubscribe | undefined {
  const c = ctx();
  if (!c) return undefined;
  useLootStore.setState({ treasures: null, trades: null, failed: false, notice: '', tradeNotice: '' });
  const fail = () => useLootStore.setState({ failed: true });
  const subs = [
    repo.watchTreasure(c.db, pid, (treasures) => useLootStore.setState({ treasures, failed: false }), fail),
    repo.watchTrades(
      c.db,
      pid,
      c.user.uid,
      (trades) => {
        useLootStore.setState({ trades, failed: false });
        void settleMyTrades(pid);
      },
      fail,
    ),
  ];
  return () => subs.forEach((u) => u());
}

// --- Treasure ---

export interface TreasureDraft {
  title: string;
  note: string;
  coins: Purse;
  items: LootItem[];
  /** A member's uid, or null for «whoever takes it first». */
  to: string | null;
}

/** The Master puts one or more treasures on the table (several when coins are split between the players). */
export async function createTreasures(pid: string, drafts: readonly TreasureDraft[]): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  const now = Date.now();
  const made = drafts.filter((d) => !treasureIsEmpty(d));
  if (made.length === 0) return 'Aggiungi almeno una moneta o un oggetto.';
  if ((useLootStore.getState().treasures?.length ?? 0) + made.length > LOOT_LIMITS.treasures) {
    return `Ci possono essere al massimo ${LOOT_LIMITS.treasures} tesori: eliminane qualcuno.`;
  }
  try {
    for (const d of made) {
      await repo.createTreasure(c.db, pid, {
        id: newId(),
        title: d.title.trim().slice(0, LOOT_LIMITS.title) || 'Tesoro',
        note: d.note.trim().slice(0, LOOT_LIMITS.note),
        coins: d.coins,
        items: d.items.slice(0, LOOT_LIMITS.items),
        to: d.to,
        status: 'open',
        claimedBy: null,
        claimedByName: '',
        claimedAt: 0,
        createdBy: c.user.uid,
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
  } catch {
    return OFFLINE;
  }
}

export async function removeTreasure(pid: string, id: string): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  try {
    await repo.deleteTreasure(c.db, pid, id);
    return null;
  } catch {
    return OFFLINE;
  }
}

/** A member takes a treasure: the first claim wins, then the goods go in the active character's backpack. */
export async function takeTreasure(pid: string, t: Treasure): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  const check = addLootToInventory(activeInventory(), t.coins, t.items, newId);
  if (check.error) return check.error;
  try {
    await repo.claimTreasure(c.db, pid, t.id, c.user.uid, c.user.username);
  } catch {
    return 'Non puoi prenderlo: forse l’ha già preso qualcun altro.';
  }
  editInventory((inv) => addLootToInventory(inv, t.coins, t.items, newId).inventory);
  useLootStore.setState({ notice: `Hai preso «${t.title}»: ${describeLoot(t.coins, t.items)}.` });
  return null;
}

// --- Trades ---

export interface Offer {
  to: { uid: string; name: string };
  itemId: string;
  quantity: number;
  note: string;
}

/** Offers an object of the active character to another member: the object waits in the offer until it is answered. */
export async function offerTrade(pid: string, offer: Offer): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  const took = takeFromInventory(activeInventory(), offer.itemId, offer.quantity);
  if (took.error || !took.taken) return took.error;
  const open = (useLootStore.getState().trades ?? []).filter((t) => t.from === c.user.uid && !t.settled).length;
  if (open >= TRADE_LIMIT) return `Hai già ${TRADE_LIMIT} offerte aperte: aspetta le risposte.`;
  const now = Date.now();
  try {
    await repo.createTrade(c.db, pid, {
      id: newId(),
      from: c.user.uid,
      fromName: c.user.username,
      to: offer.to.uid,
      toName: offer.to.name,
      item: took.taken,
      status: 'pending',
      settled: false,
      note: offer.note.trim().slice(0, 200),
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return OFFLINE;
  }
  // The offer is on the server: now the object leaves the backpack (so it exists in one place only).
  editInventory((inv) => takeFromInventory(inv, offer.itemId, offer.quantity).inventory);
  return null;
}

export async function answerTrade(pid: string, id: string, status: 'accepted' | 'declined' | 'cancelled'): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  try {
    await repo.setTradeStatus(c.db, pid, id, status);
    return null;
  } catch {
    return OFFLINE;
  }
}

export async function removeTrade(pid: string, id: string): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  try {
    await repo.deleteTrade(c.db, pid, id);
    return null;
  } catch {
    return OFFLINE;
  }
}

const inFlight = new Set<string>();

/**
 * Puts goods where they belong: what I accepted goes in my backpack, what I offered and was refused or took
 * back returns to it. The trade is marked settled first (so it can never be applied twice), then the backpack
 * changes. A full backpack waits: the offer stays until there is room.
 */
export async function settleMyTrades(pid: string): Promise<void> {
  const c = ctx();
  const trades = useLootStore.getState().trades;
  if (!c || !trades) return;
  for (const t of trades) {
    const step = tradeStep(t, c.user.uid);
    if ((step !== 'receive' && step !== 'return') || inFlight.has(t.id)) continue;
    if (addLootToInventory(activeInventory(), emptyPurse(), [t.item], newId).error) {
      useLootStore.setState({ tradeNotice: `Lo zaino è pieno: libera spazio per ${t.item.name} e riapri questa pagina.` });
      continue;
    }
    inFlight.add(t.id);
    try {
      await repo.settleTrade(c.db, pid, t.id);
      editInventory((inv) => addLootToInventory(inv, emptyPurse(), [t.item], newId).inventory);
      const what = describeLoot(emptyPurse(), [t.item]);
      useLootStore.setState({ tradeNotice: step === 'receive' ? `Hai ricevuto ${what} da ${t.fromName}.` : `${what} è tornato nel tuo zaino.` });
    } catch {
      // Offline or refused: the next snapshot tries again.
    } finally {
      inFlight.delete(t.id);
    }
  }
}
