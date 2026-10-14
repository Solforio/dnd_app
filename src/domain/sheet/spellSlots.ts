import type { ClassEntry, Sheet } from './sheet';

/**
 * Spell slots (SRD 5.1). The maximum comes from the class levels: full
 * casters, half casters (paladin, ranger), third casters (Eldritch Knight,
 * Arcane Trickster) and the warlock's separate Pact Magic. A sheet can switch
 * to hand-set maximums for anything the table does not know.
 */

export const SLOT_LEVELS = 9;

export type CasterKind = 'full' | 'half' | 'third' | 'pact';

export interface Spellcasting {
  /** Slots spent per spell level (index 0 = 1st level), until the next long rest. */
  slotsUsed: number[];
  /** Pact Magic slots spent, until the next short or long rest. */
  pactUsed: number;
  /** Hand-set maximums per spell level, or null to follow the class levels. */
  manualMax: number[] | null;
}

export const SPELLCASTING_LIMITS = { slots: 9 } as const;

export function defaultSpellcasting(): Spellcasting {
  return { slotsUsed: Array<number>(SLOT_LEVELS).fill(0), pactUsed: 0, manualMax: null };
}

const FULL = ['bardo', 'bard', 'chierico', 'cleric', 'druido', 'druid', 'stregone', 'sorcerer', 'mago', 'wizard'];
const HALF = ['paladino', 'paladin', 'ranger'];
const PACT = ['warlock'];
const THIRD: Record<string, RegExp> = {
  guerriero: /cavaliere mistico|eldritch knight/i,
  fighter: /cavaliere mistico|eldritch knight/i,
  ladro: /mistificatore arcano|arcane trickster/i,
  rogue: /mistificatore arcano|arcane trickster/i,
};

/** How a class casts, from its name (Italian or English) and, for the third casters, its subclass. */
export function casterKindOf(c: ClassEntry): CasterKind | null {
  const name = c.name.trim().toLowerCase();
  if (FULL.includes(name)) return 'full';
  if (HALF.includes(name)) return 'half';
  if (PACT.includes(name)) return 'pact';
  const third = THIRD[name];
  if (third && third.test(c.subclass)) return 'third';
  return null;
}

/** Slots per spell level for a full caster of each level (index 0 = level 1). */
const FULL_TABLE: readonly (readonly number[])[] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Pact Magic by warlock level: [number of slots, their spell level]. */
const PACT_TABLE: readonly (readonly [number, number])[] = [
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
];

const clampLevel = (n: number) => Math.min(20, Math.max(0, Math.trunc(n)));

/**
 * The level used on the full-caster table. A single casting class follows its
 * own table (half and third casters round up); several classes add full levels,
 * half levels and third levels, each rounded down (SRD multiclassing).
 */
export function casterLevel(classes: readonly ClassEntry[]): number {
  const casters = classes.filter((c) => {
    const k = casterKindOf(c);
    return k === 'full' || k === 'half' || k === 'third';
  });
  if (casters.length === 0) return 0;
  const sum = (kind: CasterKind) => casters.filter((c) => casterKindOf(c) === kind).reduce((n, c) => n + c.level, 0);
  if (casters.length === 1) {
    const c = casters[0]!;
    const kind = casterKindOf(c);
    if (kind === 'full') return c.level;
    if (kind === 'half') return c.level < 2 ? 0 : Math.ceil(c.level / 2);
    return c.level < 3 ? 0 : Math.ceil(c.level / 3);
  }
  return sum('full') + Math.floor(sum('half') / 2) + Math.floor(sum('third') / 3);
}

/** Slots per spell level from the class levels alone, ignoring any hand-set values. */
export function slotsFromClasses(classes: readonly ClassEntry[]): number[] {
  const row = FULL_TABLE[clampLevel(casterLevel(classes)) - 1] ?? [];
  return Array.from({ length: SLOT_LEVELS }, (_, i) => row[i] ?? 0);
}

/** Maximum slots per spell level: the hand-set ones when chosen, else from the classes. */
export function maxSlots(s: Sheet): number[] {
  return s.spellcasting.manualMax ? [...s.spellcasting.manualMax] : slotsFromClasses(s.classes);
}

export interface Pact {
  count: number;
  /** Spell level of every pact slot. */
  level: number;
}

/** Pact Magic of the warlock levels, or null with no warlock. */
export function pactOf(classes: readonly ClassEntry[]): Pact | null {
  const level = classes.filter((c) => casterKindOf(c) === 'pact').reduce((n, c) => n + c.level, 0);
  const row = PACT_TABLE[clampLevel(level) - 1];
  return row ? { count: row[0], level: row[1] } : null;
}

export interface SlotRow {
  /** Spell level, 1 to 9. */
  level: number;
  max: number;
  left: number;
}

/** Rows for the levels that have slots. */
export function slotRows(s: Sheet): SlotRow[] {
  const max = maxSlots(s);
  return max.flatMap((m, i) =>
    m > 0 ? [{ level: i + 1, max: m, left: m - Math.min(m, s.spellcasting.slotsUsed[i] ?? 0) }] : [],
  );
}

export function pactLeft(s: Sheet): { pact: Pact; left: number } | null {
  const pact = pactOf(s.classes);
  return pact ? { pact, left: pact.count - Math.min(pact.count, s.spellcasting.pactUsed) } : null;
}

function withUsed(s: Sheet, level: number, change: (used: number, max: number) => number): Sheet {
  const max = maxSlots(s)[level - 1] ?? 0;
  if (level < 1 || level > SLOT_LEVELS || max === 0) return s;
  const slotsUsed = [...s.spellcasting.slotsUsed];
  const used = Math.min(max, slotsUsed[level - 1] ?? 0);
  slotsUsed[level - 1] = Math.min(max, Math.max(0, change(used, max)));
  return { ...s, spellcasting: { ...s.spellcasting, slotsUsed } };
}

/** Spends one slot of a spell level; unchanged when none is left. */
export const spendSlot = (s: Sheet, level: number): Sheet => withUsed(s, level, (used, max) => (used < max ? used + 1 : used));

/** Gives one slot of a spell level back (for example Arcane Recovery). */
export const recoverSlot = (s: Sheet, level: number): Sheet => withUsed(s, level, (used) => used - 1);

export function spendPact(s: Sheet): Sheet {
  const p = pactOf(s.classes);
  if (!p || s.spellcasting.pactUsed >= p.count) return s;
  return { ...s, spellcasting: { ...s.spellcasting, pactUsed: s.spellcasting.pactUsed + 1 } };
}

export function recoverPact(s: Sheet): Sheet {
  return s.spellcasting.pactUsed > 0 ? { ...s, spellcasting: { ...s.spellcasting, pactUsed: s.spellcasting.pactUsed - 1 } } : s;
}

/** Switches to hand-set maximums (starting from the current ones), or back to the class levels. */
export function setManualSlots(s: Sheet, manual: boolean): Sheet {
  return { ...s, spellcasting: { ...s.spellcasting, manualMax: manual ? maxSlots(s) : null } };
}

export function setManualMax(s: Sheet, level: number, max: number): Sheet {
  if (!s.spellcasting.manualMax || level < 1 || level > SLOT_LEVELS) return s;
  const manualMax = [...s.spellcasting.manualMax];
  manualMax[level - 1] = Math.min(SPELLCASTING_LIMITS.slots, Math.max(0, Math.trunc(max)));
  return { ...s, spellcasting: { ...s.spellcasting, manualMax } };
}

export interface SlotRestResult {
  sheet: Sheet;
  /** What came back, for the status line: «Slot incantesimo», «Slot del Patto». */
  restored: string[];
}

/** Short rest: only the warlock's Pact Magic comes back. Long rest: everything. */
export function restoreSlots(s: Sheet, rest: 'short' | 'long'): SlotRestResult {
  const restored: string[] = [];
  let spellcasting = s.spellcasting;
  if (spellcasting.pactUsed > 0) {
    spellcasting = { ...spellcasting, pactUsed: 0 };
    restored.push('Slot del Patto');
  }
  if (rest === 'long') {
    const max = maxSlots(s);
    if (spellcasting.slotsUsed.some((u, i) => Math.min(u, max[i] ?? 0) > 0)) restored.push('Slot incantesimo');
    spellcasting = { ...spellcasting, slotsUsed: Array<number>(SLOT_LEVELS).fill(0) };
  }
  return { sheet: { ...s, spellcasting }, restored };
}
