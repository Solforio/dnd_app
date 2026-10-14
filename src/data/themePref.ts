import { create } from 'zustand';

/** The colour theme: the dark «notte» (default) or the light «pergamena». Remembered on this device. */

export type Theme = 'night' | 'parchment';
const KEY = 'dnd-companion:theme';

function load(): Theme {
  try {
    return localStorage.getItem(KEY) === 'parchment' ? 'parchment' : 'night';
  } catch {
    return 'night';
  }
}

export const useTheme = create<{ theme: Theme; set: (t: Theme) => void }>((set) => ({
  theme: load(),
  set: (theme) => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
    set({ theme });
  },
}));

/** Puts the theme on <html data-theme> now and whenever it changes. */
export function initTheme(): () => void {
  const apply = () => {
    document.documentElement.dataset.theme = useTheme.getState().theme;
  };
  apply();
  return useTheme.subscribe(apply);
}
