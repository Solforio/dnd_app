import { useId } from 'react';
import { useCharacterStore } from '../../data/characterStore';

/** Picks one of the user's own characters (the one that represents them in a party). */
export function CharacterSelect({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  const id = useId();
  const active = useCharacterStore((s) => s.character);
  const others = useCharacterStore((s) => s.others);
  const all = [active, ...others].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const known = all.some((c) => c.id === value);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={known ? value : ''} onChange={(e) => onChange(e.target.value)}>
        {!known && (
          <option value="" disabled>
            Scegli un personaggio
          </option>
        )}
        {all.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || 'Senza nome'}
          </option>
        ))}
      </select>
    </div>
  );
}
