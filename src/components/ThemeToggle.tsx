import { useTheme } from '../data/themePref';

/** Switches between the dark «notte» theme and the light «pergamena» one. */
export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const set = useTheme((s) => s.set);
  const next = theme === 'night' ? 'parchment' : 'night';
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={next === 'parchment' ? 'Passa al tema pergamena (chiaro)' : 'Passa al tema notte (scuro)'}
      title={next === 'parchment' ? 'Tema pergamena' : 'Tema notte'}
      onClick={() => set(next)}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" className="glyph theme-glyph">
        {theme === 'night' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2" />
          </>
        ) : (
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
        )}
      </svg>
    </button>
  );
}
