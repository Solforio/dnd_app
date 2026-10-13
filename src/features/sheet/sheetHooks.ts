import { useCharacterStore } from '../../data/characterStore';
import type { Sheet } from '../../domain/sheet/sheet';

export function useSheet(): Sheet {
  return useCharacterStore((s) => s.character.sheet);
}

export function editSheet(fn: (s: Sheet) => Sheet) {
  useCharacterStore.getState().editSheet(fn);
}

/** Rolls through the dice module with the character's d20 mode; the result shows in the roll strip and history. */
export function rollFrom(formula: string, label: string) {
  useCharacterStore.getState().roll(formula, label);
}

/** Replaces the item with `id` in a list. */
export function replaceById<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((x) => (x.id === id ? { ...x, ...patch } : x));
}
