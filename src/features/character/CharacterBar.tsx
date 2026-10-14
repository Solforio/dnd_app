import { useId } from 'react';
import { useNavigate } from 'react-router';
import { useCharacterStore } from '../../data/characterStore';
import { CharacterAvatar } from '../portrait/Avatar';

const MANAGE = '__manage__';

/** Active character in the header: quick switch, and the way into the characters page. */
export function CharacterBar() {
  const active = useCharacterStore((s) => s.character);
  const others = useCharacterStore((s) => s.others);
  const select = useCharacterStore((s) => s.select);
  const navigate = useNavigate();
  const id = useId();

  const all = [active, ...others].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  return (
    <div className="field header-character">
      <CharacterAvatar characterId={active.id} name={active.name} size={32} />
      <label htmlFor={id} className="visually-hidden">
        Personaggio attivo
      </label>
      <select
        id={id}
        className="header-select"
        value={active.id}
        onChange={(e) => {
          if (e.target.value === MANAGE) navigate('/personaggi');
          else select(e.target.value);
        }}
      >
        {all.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || 'Senza nome'}
          </option>
        ))}
        <option value={MANAGE}>Gestisci personaggi…</option>
      </select>
    </div>
  );
}
