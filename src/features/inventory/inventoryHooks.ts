import { useCharacterStore } from '../../data/characterStore';
import type { Inventory, Item } from '../../domain/inventory';

export function useInventory(): Inventory {
  return useCharacterStore((s) => s.character.inventory);
}

export function editInventory(fn: (inv: Inventory) => Inventory) {
  useCharacterStore.getState().editInventory(fn);
}

export function setItem(id: string, patch: Partial<Item>) {
  editInventory((inv) => ({ ...inv, items: inv.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
}
