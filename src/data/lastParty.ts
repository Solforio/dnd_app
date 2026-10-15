const KEY = 'dnd-companion:last-party';

/** The party opened last on this device: the Gruppo tab goes straight to it. */
export function lastParty(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberParty(pid: string): void {
  try {
    localStorage.setItem(KEY, pid);
  } catch {
    // Private mode: the tab simply opens the list.
  }
}

/** Forgets it when that party is left, deleted or gone. */
export function forgetLastParty(pid: string): void {
  try {
    if (localStorage.getItem(KEY) === pid) localStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to forget.
  }
}
