import { NavLink } from 'react-router';

const TABS = [
  { to: '/', label: 'Tiri' },
  { to: '/scheda', label: 'Scheda' },
  { to: '/personaggi', label: 'Personaggi' },
] as const;

export function TabNav() {
  return (
    <nav className="tabs" aria-label="Sezioni">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end className="tab">
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
