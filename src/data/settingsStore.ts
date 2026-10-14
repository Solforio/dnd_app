import { create } from 'zustand';
import { DEFAULT_SETTINGS, sanitizeSettings, TEXT_SCALE, type Settings } from '../domain/settings';

/** The device's preferences, kept in this browser and applied to the page as attributes the style sheets read. */

const KEY = 'dnd-companion:settings';

function load(): Settings {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const useSettings = create<{ settings: Settings; update: (patch: Partial<Settings>) => void; reset: () => void }>((set, get) => {
  const save = (settings: Settings) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
    set({ settings });
  };
  return {
    settings: load(),
    update: (patch) => save(sanitizeSettings({ ...get().settings, ...patch })),
    reset: () => save(DEFAULT_SETTINGS),
  };
});

/** Puts the settings on <html> now and whenever they change; returns the function that stops listening. */
export function initSettings(): () => void {
  const apply = () => {
    const s = useSettings.getState().settings;
    const root = document.documentElement;
    root.style.fontSize = `${TEXT_SCALE[s.textSize]}%`;
    root.dataset.density = s.density;
    root.dataset.ornaments = s.ornaments ? 'on' : 'off';
  };
  apply();
  return useSettings.subscribe(apply);
}
