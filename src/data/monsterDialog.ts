import type { ReactNode } from 'react';
import { create } from 'zustand';
import type { Monster } from '../domain/bestiary';

/** The monster shown in the stat-block window, and what is offered under it (for example «add to the bestiary»). */
export const useMonsterDialog = create<{
  monster: Monster | null;
  footer: ReactNode;
  open: (m: Monster, footer?: ReactNode) => void;
  close: () => void;
}>((set) => ({
  monster: null,
  footer: null,
  open: (monster, footer = null) => set({ monster, footer }),
  close: () => set({ monster: null, footer: null }),
}));
