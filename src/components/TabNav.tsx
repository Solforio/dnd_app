import { NavLink } from 'react-router';

const TABS = [
  { to: '/', label: 'Tiri', end: true },
  { to: '/scheda', label: 'Scheda', end: true },
  { to: '/zaino', label: 'Zaino', end: true },
  { to: '/mappe', label: 'Mappe', end: false },
  // Not `end`: the tab stays highlighted inside a party (/gruppo/:id).
  { to: '/gruppo', label: 'Gruppo', end: false },
] as const;

export function TabNav() {
  return (
    <nav className="tabs" aria-label="Sezioni">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="tab">
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
