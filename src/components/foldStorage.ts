/** Where the foldable cards remember if they are open (one key per card, on this device). */

export const FOLD_PREFIX = 'dnd-companion:fold:';

export const foldKey = (id: string): string => `${FOLD_PREFIX}${id}`;

/** Forgets every remembered state, so each card goes back to its default the next time it is shown. Returns how many were forgotten. */
export function resetFoldState(): number {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(FOLD_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
}
