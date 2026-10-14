import { create } from 'zustand';
import { getFirebase } from './firebase';
import { fetchSharedPortrait } from './partyRepo';
import { useSession } from './session';

/**
 * Portraits of the other members of an open party, fetched once per member
 * and per version (`portraitAt` in their summary), so a card costs one read
 * the first time and nothing afterwards.
 */

export const useSharedPortraits = create<{ byKey: Record<string, string | null> }>(() => ({ byKey: {} }));

useSession.subscribe((s, prev) => {
  if (s.phase !== prev.phase || s.user?.uid !== prev.user?.uid) useSharedPortraits.setState({ byKey: {} });
});

export const sharedPortraitKey = (pid: string, uid: string, at: number) => `${pid}/${uid}/${at}`;

const asked = new Set<string>();

export function ensureSharedPortrait(pid: string, uid: string, at: number): void {
  const key = sharedPortraitKey(pid, uid, at);
  const fb = getFirebase();
  if (!fb || asked.has(key) || key in useSharedPortraits.getState().byKey) return;
  asked.add(key);
  fetchSharedPortrait(fb.db, pid, uid)
    .then((portrait) => useSharedPortraits.setState((s) => ({ byKey: { ...s.byKey, [key]: portrait } })))
    .catch(() => asked.delete(key));
}
