import { useState } from 'react';
import { SpellSlotsCard } from '../sheet/SpellSlotsCard';

/** The grimoire: spell slots and, below them, the spells of the character. */
export function GrimoirePage() {
  const [editing, setEditing] = useState(false);
  return (
    <main className="app-main single">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Grimorio</h2>
        <button type="button" className={editing ? 'primary' : undefined} aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Fine modifiche' : 'Modifica gli slot'}
        </button>
      </div>
      <SpellSlotsCard editing={editing} alwaysShow />
    </main>
  );
}
