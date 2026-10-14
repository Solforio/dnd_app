import { create } from 'zustand';
import { NO_PORTRAITS, type Portraits } from '../domain/portrait';
import { getFirebase } from './firebase';
import { fetchCloudPortraits, loadLocalPortraits, saveCloudPortraits, saveLocalPortraits } from './portraitRepo';
import { useSession } from './session';

/**
 * The pictures of the characters on this device or account, loaded one
 * character at a time (when it is shown) and kept in memory. Local workspace:
 * IndexedDB; account: one small Firestore document per character.
 */

interface PortraitState {
  /** By character id; undefined until loaded, null when the character has no picture. */
  byId: Record<string, Portraits | null | undefined>;
  error: string | null;
}

export const usePortraitStore = create<PortraitState>(() => ({ byId: {}, error: null }));

function cloud() {
  const fb = getFirebase();
  const s = useSession.getState();
  return fb && s.user && s.phase === 'cloud' ? { db: fb.db, uid: s.user.uid } : null;
}

const inFlight = new Set<string>();

useSession.subscribe((s, prev) => {
  if (s.phase !== prev.phase || s.user?.uid !== prev.user?.uid) {
    inFlight.clear();
    usePortraitStore.setState({ byId: {}, error: null });
  }
});

/** Loads the pictures of a character once per workspace. */
export async function ensurePortraits(characterId: string): Promise<void> {
  const phase = useSession.getState().phase;
  if ((phase !== 'local' && phase !== 'cloud') || usePortraitStore.getState().byId[characterId] !== undefined) return;
  if (inFlight.has(characterId)) return;
  inFlight.add(characterId);
  const c = cloud();
  try {
    const found = c ? await fetchCloudPortraits(c.db, c.uid, characterId) : await loadLocalPortraits(characterId);
    if (inFlight.has(characterId)) usePortraitStore.setState((s) => ({ byId: { ...s.byId, [characterId]: found } }));
  } catch {
    // Offline and never seen: show nothing now, try again the next time it is shown.
  } finally {
    inFlight.delete(characterId);
  }
}

/** Sets (or, with null, removes) one picture; the change shows at once and is saved right away. */
export async function setPicture(characterId: string, kind: 'portrait' | 'body', dataUrl: string | null): Promise<void> {
  const before = usePortraitStore.getState().byId[characterId] ?? null;
  const next: Portraits = { ...(before ?? NO_PORTRAITS), [kind]: dataUrl, updatedAt: Date.now() };
  usePortraitStore.setState((s) => ({ byId: { ...s.byId, [characterId]: next }, error: null }));
  const c = cloud();
  try {
    if (c) await saveCloudPortraits(c.db, c.uid, characterId, next);
    else await saveLocalPortraits(characterId, next);
  } catch {
    usePortraitStore.setState((s) => ({
      byId: { ...s.byId, [characterId]: before },
      error: 'Non sono riuscito a salvare l’immagine: controlla la connessione e riprova.',
    }));
  }
}
