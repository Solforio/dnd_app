import { loadCharacter, type Character } from './character';

/**
 * What a player who chooses to share their full sheet publishes for the Master: the whole character
 * without the roll history and the saved rolls (long and of no use to the DM). Read-only for the DM.
 */

export const MASTER_VIEW_SCHEMA_VERSION = 1;

export function buildMasterView(c: Character): Character {
  return { ...c, history: [], presets: [] };
}

/** Compact text of a view, to tell whether it changed since the last time it was sent. */
export function masterViewKey(view: Character): string {
  return JSON.stringify({ ...view, updatedAt: 0 });
}

/** Reads a shared sheet from Firestore (written by another user): through the same migrations and sanitizers as any character. */
export function readMasterView(raw: unknown): Character | null {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
  if (!r) return null;
  try {
    return loadCharacter(r.character);
  } catch {
    return null;
  }
}
