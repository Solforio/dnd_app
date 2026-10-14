import type { Unsubscribe } from 'firebase/firestore';
import { create } from 'zustand';
import { newId } from '../domain/character';
import { BESTIARY_LIMITS, NO_CUSTOM, type BestiaryEntry } from '../domain/bestiary';
import { getFirebase } from './firebase';
import * as repo from './partyRepo';
import { useSession } from './session';

/**
 * The bestiary of the party that is open: one listener while its page is shown (at most 300 entries,
 * one document each). Adding and editing go straight to Firestore; the listener brings them back.
 */

interface BestiaryState {
  /** null until the listener delivers. */
  entries: BestiaryEntry[] | null;
  failed: boolean;
}

export const useBestiaryStore = create<BestiaryState>(() => ({ entries: null, failed: false }));

const OFFLINE = 'Operazione non riuscita: controlla la connessione e riprova.';

function ctx() {
  const fb = getFirebase();
  const s = useSession.getState();
  return fb && s.user && s.phase === 'cloud' ? { db: fb.db, user: s.user } : null;
}

export function watchBestiary(pid: string): Unsubscribe | undefined {
  const c = ctx();
  if (!c) return undefined;
  useBestiaryStore.setState({ entries: null, failed: false });
  return repo.watchBestiary(
    c.db,
    pid,
    (entries) => useBestiaryStore.setState({ entries, failed: false }),
    () => useBestiaryStore.setState({ failed: true }),
  );
}

export interface NewEntry {
  name: string;
  srdId: string | null;
  creatureType?: string;
  place?: string;
}

/** Adds a creature to a party's bestiary; returns an error text, or null. `known` is what the party already has. */
export async function addBestiaryEntry(pid: string, input: NewEntry, known: readonly BestiaryEntry[] = []): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  const name = input.name.trim().slice(0, BESTIARY_LIMITS.name);
  if (!name) return 'Scrivi il nome della creatura.';
  if (known.length >= BESTIARY_LIMITS.entries) return `Il bestiario può avere al massimo ${BESTIARY_LIMITS.entries} creature.`;
  if (known.some((e) => (input.srdId !== null && e.srdId === input.srdId) || e.name.toLowerCase() === name.toLowerCase())) {
    return `«${name}» è già nel bestiario.`;
  }
  const now = Date.now();
  // An SRD monster has a fixed id, so the same creature can never be added twice, even by two members at once.
  const entry: BestiaryEntry = {
    id: input.srdId ? `srd-${input.srdId}` : newId(),
    name,
    srdId: input.srdId,
    creatureType: (input.creatureType ?? '').trim().slice(0, BESTIARY_LIMITS.customText),
    place: (input.place ?? '').trim().slice(0, BESTIARY_LIMITS.place),
    notes: '',
    revealed: [],
    custom: { ...NO_CUSTOM },
    createdBy: c.user.uid,
    createdByName: c.user.username,
    createdAt: now,
    updatedAt: now,
  };
  try {
    if (input.srdId && (await repo.bestiaryEntryExists(c.db, pid, entry.id))) return `«${name}» è già nel bestiario.`;
    await repo.createBestiaryEntry(c.db, pid, entry);
    return null;
  } catch {
    return OFFLINE;
  }
}

export async function patchBestiaryEntry(pid: string, id: string, patch: repo.BestiaryPatch): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  try {
    await repo.updateBestiaryEntry(c.db, pid, id, patch);
    return null;
  } catch {
    return OFFLINE;
  }
}

export async function setBestiaryReveal(pid: string, id: string, section: string, known: boolean): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  try {
    await repo.setBestiaryReveal(c.db, pid, id, section, known);
    return null;
  } catch {
    return OFFLINE;
  }
}

export async function removeBestiaryEntry(pid: string, id: string): Promise<string | null> {
  const c = ctx();
  if (!c) return OFFLINE;
  try {
    await repo.deleteBestiaryEntry(c.db, pid, id);
    return null;
  } catch {
    return OFFLINE;
  }
}
