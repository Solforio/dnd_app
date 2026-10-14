import { create } from 'zustand';

/**
 * Whether the dice move. Default: follow the system («riduci animazioni»);
 * the user can force them on or off, because that system switch is often off
 * without the person knowing (Windows "Mostra animazioni").
 */

export type DiceMotion = 'auto' | 'on' | 'off';
const KEY = 'dnd-companion:dice-motion';

function load(): DiceMotion {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export const useDiceMotion = create<{ mode: DiceMotion; set: (m: DiceMotion) => void }>((set) => ({
  mode: load(),
  set: (mode) => {
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
    set({ mode });
  },
}));

export function systemReducesMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Puts the effective choice on <html data-motion="on|off">, so the style sheet can switch every decorative
 * animation (embers, rune ring, rising cards, shimmer) with the same setting as the dice.
 * Returns a function that stops listening.
 */
export function syncMotionAttribute(): () => void {
  const apply = () => {
    document.documentElement.dataset.motion = diceMotionOn() ? 'on' : 'off';
  };
  apply();
  const unsubscribe = useDiceMotion.subscribe(apply);
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', apply);
  return () => {
    unsubscribe();
    media.removeEventListener('change', apply);
  };
}

/** True when the dice should tumble and wobble. */
export function diceMotionOn(mode: DiceMotion = useDiceMotion.getState().mode): boolean {
  return mode === 'on' || (mode === 'auto' && !systemReducesMotion());
}
