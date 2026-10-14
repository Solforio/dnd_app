import { create } from 'zustand';
import type { Spell } from '../domain/spells';

/**
 * The spell reading dialog and the short notice shown after a cast. After a cast the player gets a
 * notice with a «Leggi» button; with the «apri sempre» choice the description opens by itself.
 */

const KEY = 'dnd-companion:spell-popup';

function loadAuto(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

interface SpellDialogState {
  /** The spell being read, or null. */
  spell: Spell | null;
  /** The notice after a cast. */
  notice: { spell: Spell; message: string } | null;
  autoOpen: boolean;
  open: (spell: Spell) => void;
  close: () => void;
  announceCast: (spell: Spell, message: string) => void;
  dismissNotice: () => void;
  setAutoOpen: (on: boolean) => void;
}

export const useSpellDialog = create<SpellDialogState>((set, get) => ({
  spell: null,
  notice: null,
  autoOpen: loadAuto(),
  open: (spell) => set({ spell, notice: null }),
  close: () => set({ spell: null }),
  announceCast: (spell, message) => (get().autoOpen ? set({ spell, notice: { spell, message } }) : set({ notice: { spell, message } })),
  dismissNotice: () => set({ notice: null }),
  setAutoOpen: (autoOpen) => {
    try {
      localStorage.setItem(KEY, autoOpen ? 'on' : 'off');
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
    set({ autoOpen });
  },
}));
