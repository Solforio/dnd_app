import { createCharacter, type Character } from './character';

/**
 * The characters of one workspace (browser or account): the active one plus
 * the others. Pure operations, so the store stays thin.
 */
export interface Workspace {
  character: Character;
  others: Character[];
}

/** Soft limit, enforced in the UI only: Firestore rules cannot count documents. */
export const CHARACTER_LIMIT = 20;
export const LIMIT_MESSAGE = `Puoi avere al massimo ${CHARACTER_LIMIT} personaggi: eliminane uno per crearne un altro.`;

export function allCharacters(w: Workspace): Character[] {
  return [w.character, ...w.others];
}

export function isFull(w: Workspace): boolean {
  return allCharacters(w).length >= CHARACTER_LIMIT;
}

/** Makes `id` the active character. Unknown ids leave the workspace unchanged. */
export function selectIn(w: Workspace, id: string): Workspace {
  const all = allCharacters(w);
  const character = all.find((c) => c.id === id);
  if (!character) return w;
  return { character, others: all.filter((c) => c.id !== id) };
}

/** Adds `c` as the active character, replacing a character with the same id if there is one. */
export function addAndSelect(w: Workspace, c: Character): Workspace {
  return { character: c, others: allCharacters(w).filter((o) => o.id !== c.id) };
}

/** A copy with a new id and an empty roll history. */
export function duplicate(c: Character, newId: string, now = Date.now()): Character {
  const copy = structuredClone(c);
  return { ...copy, id: newId, name: `${c.name} (copia)`.slice(0, 80), history: [], updatedAt: now };
}

/**
 * Removes `id`. If it was the active character the next one becomes active;
 * removing the last one leaves a fresh blank character.
 */
export function removeFrom(w: Workspace, id: string): Workspace {
  if (w.character.id !== id) return { ...w, others: w.others.filter((c) => c.id !== id) };
  const [next, ...rest] = w.others;
  return next ? { character: next, others: rest } : { character: createCharacter(), others: [] };
}
