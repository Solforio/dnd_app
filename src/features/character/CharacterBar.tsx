import { useId } from 'react';
import { useCharacterStore } from '../../data/characterStore';

/** Active character in the header, with a quick switch when there are several. */
export function CharacterBar() {
  const active = useCharacterStore((s) => s.character);
  const others = useCharacterStore((s) => s.others);
  const select = useCharacterStore((s) => s.select);
  const id = useId();

  if (others.length === 0) return <span className="header-name">{active.name || 'Senza nome'}</span>;

  const all = [active, ...others].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  return (
    <div className="field">
      <label htmlFor={id} className="visually-hidden">
        Personaggio attivo
      </label>
      <select id={id} className="header-select" value={active.id} onChange={(e) => select(e.target.value)}>
        {all.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || 'Senza nome'}
          </option>
        ))}
      </select>
    </div>
  );
}
