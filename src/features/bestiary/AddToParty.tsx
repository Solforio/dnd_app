import { useId, useState } from 'react';
import { Link } from 'react-router';
import { addBestiaryEntry } from '../../data/bestiaryStore';
import { usePartyStore } from '../../data/partyStore';
import type { Monster } from '../../domain/bestiary';

/** Under a stat block in the catalogue: put this creature in the bestiary of one of my parties. */
export function AddToParty({ monster }: { monster: Monster }) {
  const memberships = usePartyStore((s) => s.memberships);
  const [chosen, setChosen] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useId();

  if (!memberships || memberships.length === 0) {
    return (
      <p className="small muted">
        Per aggiungerla al bestiario di un gruppo devi essere in un gruppo: <Link to="/gruppo">vai ai gruppi</Link>.
      </p>
    );
  }
  const pid = chosen || memberships[0]!.partyId;

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field">
          <label htmlFor={id}>Bestiario del gruppo</label>
          <select id={id} value={pid} onChange={(e) => setChosen(e.target.value)}>
            {memberships.map((m) => (
              <option key={m.partyId} value={m.partyId}>
                {m.name || 'Gruppo senza nome'}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const err = await addBestiaryEntry(pid, { name: monster.name, srdId: monster.id });
            setBusy(false);
            setMessage(err ?? `«${monster.name}» aggiunto al bestiario del gruppo.`);
          }}
        >
          Aggiungi al bestiario
        </button>
      </div>
      <p className="status-line small" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
