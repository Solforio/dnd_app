import { create } from 'zustand';

/**
 * The dice chosen in the tray, shared by the tray and the big 3D die (a tap on
 * the die rolls what is chosen). It starts with a single d20.
 */

export const TRAY_DICE = [4, 6, 8, 10, 12, 20, 100] as const;
export const MAX_PER_DIE = 20;
export type TrayDie = (typeof TRAY_DICE)[number];
export type Counts = Record<TrayDie, number>;

const EMPTY: Counts = { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 };

interface TrayState {
  counts: Counts;
  /** Dice in the order they were first chosen: the first one is the die the 3D animation shows. */
  order: TrayDie[];
  modifier: number;
  add: (sides: TrayDie, delta: number) => void;
  setModifier: (n: number) => void;
  /** Back to a single d20, no modifier. */
  reset: () => void;
}

const initial = () => ({ counts: { ...EMPTY, 20: 1 }, order: [20 as TrayDie], modifier: 0 });

export const useTray = create<TrayState>((set) => ({
  ...initial(),
  add: (sides, delta) =>
    set((p) => {
      const next = Math.min(MAX_PER_DIE, Math.max(0, p.counts[sides] + delta));
      const rest = p.order.filter((x) => x !== sides);
      return { counts: { ...p.counts, [sides]: next }, order: next === 0 ? rest : p.order.includes(sides) ? p.order : [...rest, sides] };
    }),
  setModifier: (modifier) => set({ modifier: Math.max(-99, Math.min(99, Math.trunc(modifier) || 0)) }),
  reset: () => set(initial()),
}));

/** «2d6+1d4+3» from the chosen dice, or '' when none is chosen. */
export function trayFormula(s: Pick<TrayState, 'counts' | 'order' | 'modifier'>): string {
  const parts = s.order.filter((d) => s.counts[d] > 0).map((d) => `${s.counts[d]}d${d}`);
  if (parts.length === 0) return '';
  const mod = s.modifier > 0 ? `+${s.modifier}` : s.modifier < 0 ? `${s.modifier}` : '';
  return parts.join('+') + mod;
}

export function isDefaultTray(s: Pick<TrayState, 'counts' | 'order' | 'modifier'>): boolean {
  return trayFormula(s) === '1d20';
}
