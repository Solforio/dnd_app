import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { TextField } from '../../components/TextField';
import { useCharacterStore } from '../../data/characterStore';
import { createParty, joinParty, usePartyStore } from '../../data/partyStore';
import { useSession } from '../../data/session';
import { PARTY_LIMIT, TEXT_LIMITS } from '../../domain/party';
import { formatNumber } from '../../domain/format/number';
import { CharacterSelect } from './CharacterSelect';

/** "My parties", plus creating one or joining with a code. */
export function PartiesPage() {
  const phase = useSession((s) => s.phase);
  const memberships = usePartyStore((s) => s.memberships);
  const activeId = useCharacterStore((s) => s.character.id);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [campaign, setCampaign] = useState('');
  const [code, setCode] = useState('');
  const [createWith, setCreateWith] = useState(activeId);
  const [joinWith, setJoinWith] = useState(activeId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (phase !== 'cloud') {
    return (
      <main className="app-main single">
        <section className="card stack">
          <h2>Gruppo</h2>
          <p>I gruppi sono condivisi con gli amici, quindi servono un account e la connessione.</p>
          <div>
            <Link className="button-link" to="/accedi">
              Accedi o registrati
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const full = (memberships?.length ?? 0) >= PARTY_LIMIT;

  const run = async (e: FormEvent, action: () => Promise<string | null>) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const err = await action();
    setBusy(false);
    if (err) {
      setMessage(err);
      return;
    }
    const pid = usePartyStore.getState().openId;
    if (pid) navigate(`/gruppo/${pid}`);
  };

  return (
    <main className="app-main single">
      <section className="card stack" aria-labelledby="parties-title">
        <h2 id="parties-title">I miei gruppi</h2>
        {memberships === null ? (
          <p className="muted" role="status">
            Carico i tuoi gruppi…
          </p>
        ) : memberships.length === 0 ? (
          <p className="muted">Non fai ancora parte di un gruppo: creane uno o unisciti con un codice.</p>
        ) : (
          <ul className="list">
            {memberships.map((m) => (
              <li key={m.partyId}>
                <Link to={`/gruppo/${m.partyId}`} className="party-link">
                  <span className="character-name">{m.name || 'Gruppo'}</span>
                  {m.role === 'dm' && <span className="result-tag crit">DM</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {full && <p className="small muted">Fai già parte di {formatNumber(PARTY_LIMIT)} gruppi, il massimo: esci da uno per aggiungerne altri.</p>}
        <p className="error" role="alert">
          {message}
        </p>
      </section>

      <form className="card stack" aria-labelledby="join-title" onSubmit={(e) => run(e, () => joinParty(code, joinWith))}>
        <h2 id="join-title">Unisciti con un codice</h2>
        <div className="form-grid">
          <TextField label="Codice del gruppo" value={code} maxLength={12} placeholder="K7QM-X2PD" onChange={setCode} />
          <CharacterSelect label="Partecipi con" value={joinWith} onChange={setJoinWith} />
        </div>
        <div>
          <button type="submit" className="primary" disabled={busy || full || code.trim() === ''}>
            Unisciti
          </button>
        </div>
      </form>

      <form className="card stack" aria-labelledby="create-title" onSubmit={(e) => run(e, () => createParty(name, campaign, createWith))}>
        <h2 id="create-title">Crea un gruppo</h2>
        <p className="small muted">Diventi il DM: gestisci missioni, codice e membri.</p>
        <div className="form-grid">
          <TextField label="Nome del gruppo" value={name} maxLength={TEXT_LIMITS.name} placeholder="La Compagnia del Drago" onChange={setName} />
          <TextField label="Campagna (facoltativa)" value={campaign} maxLength={TEXT_LIMITS.campaign} onChange={setCampaign} />
          <CharacterSelect label="Partecipi con" value={createWith} onChange={setCreateWith} />
        </div>
        <div>
          <button type="submit" className="primary" disabled={busy || full || name.trim() === ''}>
            Crea il gruppo
          </button>
        </div>
      </form>
    </main>
  );
}
