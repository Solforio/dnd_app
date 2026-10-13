import { useEffect, useId, useState } from 'react';
import { TextField } from '../../components/TextField';
import { regenerateCode, updatePartyInfo } from '../../data/partyStore';
import { countdown, formatJoinCode, formatSessionDate, TEXT_LIMITS, type Party } from '../../domain/party';

/** Re-renders every minute, for the countdown. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** "2026-10-18T21:00" in local time, as datetime-local wants it. */
function toLocalInput(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PartyEditor({ party, onDone }: { party: Party; onDone: (msg: string) => void }) {
  const whenId = useId();
  const [name, setName] = useState(party.name);
  const [campaign, setCampaign] = useState(party.campaignName);
  const [location, setLocation] = useState(party.currentLocation);
  const [when, setWhen] = useState(party.nextSession ? toLocalInput(party.nextSession.at) : '');
  const [place, setPlace] = useState(party.nextSession?.place ?? '');
  const [note, setNote] = useState(party.nextSession?.note ?? '');
  const [error, setError] = useState('');

  const save = async () => {
    if (name.trim() === '') {
      setError('Il gruppo ha bisogno di un nome.');
      return;
    }
    const at = when ? new Date(when).getTime() : NaN;
    const err = await updatePartyInfo({
      name: name.trim(),
      campaignName: campaign.trim(),
      currentLocation: location.trim(),
      nextSession: Number.isFinite(at) ? { at, place: place.trim(), note: note.trim() } : null,
    });
    if (err) setError(err);
    else onDone('Informazioni del gruppo salvate.');
  };

  return (
    <div className="stack">
      <div className="form-grid">
        <TextField label="Nome del gruppo" value={name} maxLength={TEXT_LIMITS.name} onChange={setName} />
        <TextField label="Campagna" value={campaign} maxLength={TEXT_LIMITS.campaign} onChange={setCampaign} />
        <TextField label="Luogo attuale" value={location} maxLength={TEXT_LIMITS.location} onChange={setLocation} />
      </div>
      <fieldset className="plain stack">
        <legend className="label">Prossima sessione (lascia vuota la data se non è in programma)</legend>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={whenId}>Data e ora</label>
            <input id={whenId} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <TextField label="Dove" value={place} maxLength={TEXT_LIMITS.place} placeholder="Da Marco" onChange={setPlace} />
        </div>
        <TextField label="Nota" value={note} maxLength={TEXT_LIMITS.note} placeholder="Porta i dadi e le patatine" onChange={setNote} />
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="button" className="primary" onClick={() => void save()}>
          Salva
        </button>
        <button type="button" onClick={() => onDone('')}>
          Annulla
        </button>
      </div>
    </div>
  );
}

export function PartyHeader({ party, isDm }: { party: Party; isDm: boolean }) {
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const [confirmCode, setConfirmCode] = useState(false);
  const [message, setMessage] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatJoinCode(party.joinCode));
      setMessage('Codice copiato: mandalo agli amici.');
    } catch {
      setMessage(`Copia non riuscita: il codice è ${formatJoinCode(party.joinCode)}.`);
    }
  };

  const act = async (fn: () => Promise<string | null>, ok: string) => setMessage((await fn()) ?? ok);

  return (
    <section className="card stack span-all" aria-labelledby="party-name">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 id="party-name" style={{ margin: 0 }}>
            {party.name}
          </h2>
          <p className="small muted">
            {[party.campaignName && `Campagna: ${party.campaignName}`, party.currentLocation && `Luogo: ${party.currentLocation}`]
              .filter(Boolean)
              .join(' · ') || (isDm ? 'Aggiungi campagna e luogo con «Modifica».' : '')}
          </p>
        </div>
        {isDm && !editing && (
          <button type="button" onClick={() => setEditing(true)}>
            Modifica
          </button>
        )}
      </div>

      {editing ? (
        <PartyEditor
          party={party}
          onDone={(msg) => {
            setEditing(false);
            setMessage(msg);
          }}
        />
      ) : (
        <div className="next-session">
          <span className="label">Prossima sessione</span>
          {party.nextSession ? (
            <p>
              <strong>{formatSessionDate(party.nextSession.at)}</strong>
              {party.nextSession.place && ` · ${party.nextSession.place}`} ·{' '}
              <span className="gold">{countdown(party.nextSession.at, now)}</span>
              {party.nextSession.note && <span className="small muted pre-wrap"> — {party.nextSession.note}</span>}
            </p>
          ) : (
            <p className="muted">Non ancora fissata.</p>
          )}
        </div>
      )}

      <div className="row join-code">
        <span className="label">Codice del gruppo</span>
        <code className="code">{formatJoinCode(party.joinCode)}</code>
        <button type="button" onClick={() => void copy()}>
          Copia
        </button>
        {!party.joinEnabled && <span className="result-tag fumble">iscrizioni chiuse</span>}
      </div>

      {isDm && (
        <div className="row">
          {confirmCode ? (
            <div className="row" role="group" aria-label="Conferma nuovo codice">
              <span className="small">Il codice attuale smetterà di funzionare. Chi è già nel gruppo resta.</span>
              <button
                type="button"
                className="primary"
                autoFocus
                onClick={() => {
                  setConfirmCode(false);
                  void act(regenerateCode, 'Nuovo codice pronto.');
                }}
              >
                Genera
              </button>
              <button type="button" onClick={() => setConfirmCode(false)}>
                Annulla
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmCode(true)}>
              Nuovo codice
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              void act(
                () => updatePartyInfo({ joinEnabled: !party.joinEnabled }),
                party.joinEnabled ? 'Iscrizioni chiuse: il codice non funziona finché non le riapri.' : 'Iscrizioni riaperte.',
              )
            }
          >
            {party.joinEnabled ? 'Chiudi le iscrizioni' : 'Riapri le iscrizioni'}
          </button>
        </div>
      )}

      <p className="small muted status-line" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
