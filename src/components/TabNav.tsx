import { NavLink } from 'react-router';
import { useCharacterStore } from '../data/characterStore';

const TABS = [
  { to: '/', label: 'Tiri', end: true },
  { to: '/scheda', label: 'Scheda', end: true },
  { to: '/combattimento', label: 'Combattimento', end: true },
  { to: '/zaino', label: 'Zaino', end: true },
  { to: '/grimorio', label: 'Grimorio', end: true },
  { to: '/mappe', label: 'Mappe', end: false },
  // Not `end`: the tab stays highlighted inside a party (/gruppo/:id).
  { to: '/gruppo', label: 'Gruppo', end: false },
] as const;

export function TabNav() {
  const inCombat = useCharacterStore((s) => s.character.sheet.combat.active);
  return (
    <nav className="tabs" aria-label="Sezioni">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="tab">
          {t.label}
          {t.to === '/combattimento' && inCombat && <span className="tab-live" role="img" aria-label="in corso" />}
        </NavLink>
      ))}
    </nav>
  );
}
