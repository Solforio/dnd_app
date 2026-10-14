import { useCharacterStore } from '../../data/characterStore';
import { capacityLb, carriedWeightLb, encumbrance, speedPenaltyM } from '../../domain/inventory';
import type { Sheet } from '../../domain/sheet/sheet';

export function useSheet(): Sheet {
  return useCharacterStore((s) => s.character.sheet);
}

/** Metres of speed lost to the weight carried (variant encumbrance), 0 when none. */
export function useSpeedPenalty(): number {
  const strength = useCharacterStore((s) => s.character.sheet.abilities.str);
  const inventory = useCharacterStore((s) => s.character.inventory);
  const variant = inventory.settings.variantEncumbrance;
  return speedPenaltyM(encumbrance(carriedWeightLb(inventory), capacityLb(strength, inventory.settings), variant), variant);
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
