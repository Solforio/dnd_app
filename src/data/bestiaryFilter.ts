import { NO_FILTER, sanitizeFilter, type MonsterFilter } from '../domain/bestiary';

const KEY = 'dnd-companion:bestiary-filter';

/** The search and filters of the catalogue as they were left on this device. */
export function loadFilter(): MonsterFilter {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeFilter(JSON.parse(raw)) : NO_FILTER;
  } catch {
    return NO_FILTER;
  }
}

export function saveFilter(filter: MonsterFilter): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(filter));
  } catch {
    // Private mode: the filters are simply not remembered.
  }
}
