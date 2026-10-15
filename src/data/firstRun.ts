const KEY = 'dnd-companion:first-run-done';

/** True once the first-run card was used or sent away on this device. */
export function firstRunDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markFirstRunDone(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Private mode: the card may come back next time, which is harmless.
  }
}
