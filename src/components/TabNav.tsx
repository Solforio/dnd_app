import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useCharacterStore } from '../data/characterStore';

/** Small line icons, one per section, drawn on a 24-pixel grid in the text colour. */
const ICONS: Record<string, ReactNode> = {
  dice: (
    <>
      <path d="M12 2 21 7v10l-9 5-9-5V7z" />
      <path d="M12 7l5 8H7z M12 2v5 M21 7l-4 8 M3 7l4 8 M7 15l5 7 5-7" />
    </>
  ),
  scroll: (
    <>
      <path d="M7 4h12v13a3 3 0 0 0 3 3H9a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2z" />
      <path d="M6 7H4a1 1 0 0 0-1 1v1a2 2 0 0 0 3 1.7 M10 9h6 M10 13h6" />
    </>
  ),
  swords: <path d="M4 4l16 16 M20 4 4 20 M3 7l4-4 M21 17l-4 4 M17 3l4 4 M7 21l-4-4" />,
  satchel: (
    <>
      <path d="M6 9h12l1.5 11h-15z M9 9V7a3 3 0 0 1 6 0v2" />
      <path d="M10 14h4" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h10 M11 7.5l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L8.5 9.8l2-.3z" />
    </>
  ),
  map: <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" />,
  skull: (
    <>
      <path d="M5 4c0 3 1 4 3 5 M19 4c0 3-1 4-3 5 M7 9c0-2 2-3 5-3s5 1 5 3v5c0 3-2 6-5 6s-5-3-5-6z M10 17h4" />
      <circle cx="10" cy="12" r="1.1" />
      <circle cx="14" cy="12" r="1.1" />
    </>
  ),
  banner: (
    <>
      <path d="M6 3v18 M6 4h13l-3.5 4.5L19 13H6" />
      <path d="M4 21h4" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  ),
};

const TABS = [
  { to: '/', label: 'Tiri', icon: 'dice', end: true },
  { to: '/scheda', label: 'Scheda', icon: 'scroll', end: true },
  { to: '/combattimento', label: 'Combattimento', icon: 'swords', end: true },
  { to: '/zaino', label: 'Zaino', icon: 'satchel', end: true },
  { to: '/grimorio', label: 'Grimorio', icon: 'book', end: true },
  { to: '/bestiario', label: 'Bestiario', icon: 'skull', end: true },
  { to: '/mappe', label: 'Mappe', icon: 'map', end: false },
  // Not `end`: the tab stays highlighted inside a party (/gruppo/:id).
  { to: '/gruppo', label: 'Gruppo', icon: 'banner', end: false },
] as const;

/** On a phone the bar sits at the bottom with the four sections used most; the others are behind «Altro». */
const MAIN_TABS = TABS.filter((t) => ['/', '/scheda', '/combattimento', '/zaino'].includes(t.to));
const MORE_TABS = TABS.filter((t) => !MAIN_TABS.includes(t));

function TabIcon({ name }: { name: string }) {
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}

export function TabNav() {
  const inCombat = useCharacterStore((s) => s.character.sheet.combat.active);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const nav = useRef<HTMLElement>(null);
  // The sheet is open for the page it was opened on, so a page change closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const moreOpen = openAt === pathname;
  const setMoreOpen = (open: boolean) => setOpenAt(open ? pathname : null);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive = MORE_TABS.some((t) => (t.end ? pathname === t.to : pathname.startsWith(t.to)));

  // The «Altro» sheet also closes on Escape and on a tap outside it.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenAt(null);
    const onDown = (e: PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setOpenAt(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [moreOpen]);

  // On a narrow screen the tab bar scrolls: keep the current section in view, also after a deep link.
  useEffect(() => {
    nav.current?.querySelector('.tab.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  /** Changes page inside a view transition (a fade and slide) when the browser can. */
  const go = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (!plain || !document.startViewTransition) return;
    e.preventDefault();
    document.startViewTransition(() => {
      flushSync(() => navigate(to));
    });
  };
  const link = (t: (typeof TABS)[number]) => (
    <NavLink key={t.to} to={t.to} end={t.end} className="tab" onClick={(e) => go(e, t.to)}>
      <TabIcon name={t.icon} />
      <span>{t.label}</span>
      {t.to === '/combattimento' && inCombat && <span className="tab-live" role="img" aria-label="in corso" />}
    </NavLink>
  );

  return (
    <>
      <nav ref={nav} className="tabs" aria-label="Sezioni">
        {TABS.map(link)}
      </nav>
      <div ref={moreRef} className="bottom-nav-wrap">
        {moreOpen && (
          <div id="more-sheet" className="more-sheet" role="group" aria-label="Altre sezioni">
            {MORE_TABS.map(link)}
          </div>
        )}
        <nav className="bottom-nav" aria-label="Sezioni">
          {MAIN_TABS.map(link)}
          <button
            type="button"
            className={`tab more-tab${moreActive ? ' active' : ''}`}
            aria-expanded={moreOpen}
            aria-controls="more-sheet"
            onClick={() => setMoreOpen(!moreOpen)}
          >
            <TabIcon name="more" />
            <span>Altro</span>
          </button>
        </nav>
      </div>
    </>
  );
}
