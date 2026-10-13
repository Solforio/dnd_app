import { useId } from 'react';
import { useCharacterStore } from '../../data/characterStore';

/** The character sheet of the active character. */
export function SheetPage() {
  const name = useCharacterStore((s) => s.character.name);
  const rename = useCharacterStore((s) => s.rename);
  const nameId = useId();

  return (
    <main className="app-main single">
      <section className="card stack" aria-label="Scheda del personaggio">
        <div className="field">
          <label htmlFor={nameId}>Nome del personaggio</label>
          <input id={nameId} className="name-input" value={name} maxLength={80} onChange={(e) => rename(e.target.value)} />
        </div>
      </section>
    </main>
  );
}
