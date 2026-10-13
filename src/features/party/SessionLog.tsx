import { useId, useState } from 'react';
import { TextField } from '../../components/TextField';
import { deleteLogEntry, loadOlderLog, saveLogEntry, usePartyStore } from '../../data/partyStore';
import { LOG_PAGE, TEXT_LIMITS, type LogEntry } from '../../domain/party';

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function EntryForm({ entry, onDone }: { entry?: LogEntry; onDone: (err: string | null) => void }) {
  const dateId = useId();
  const [title, setTitle] = useState(entry?.title ?? '');
  const [date, setDate] = useState(entry ? entry.sessionDate : today());
  const [body, setBody] = useState(entry?.body ?? '');
  return (
    <form
      className="stack attack-edit"
      onSubmit={async (e) => {
        e.preventDefault();
        if (title.trim() === '') return;
        onDone(await saveLogEntry({ ...entry, title: title.trim(), sessionDate: date, body }));
      }}
    >
      <div className="form-grid">
        <TextField label="Titolo" value={title} maxLength={TEXT_LIMITS.logTitle} placeholder="Sessione 3: la grotta dei goblin" onChange={setTitle} />
        <div className="field">
          <label htmlFor={dateId}>Data della sessione</label>
          <input id={dateId} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <TextField label="Cosa è successo" multiline value={body} maxLength={TEXT_LIMITS.logBody} onChange={setBody} />
      <div className="row">
        <button type="submit" className="primary" disabled={title.trim() === ''}>
          {entry ? 'Salva' : 'Aggiungi al diario'}
        </button>
        <button type="button" onClick={() => onDone(null)}>
          Annulla
        </button>
      </div>
    </form>
  );
}

function Entry({ e, canEdit, onMessage }: { e: LogEntry; canEdit: boolean; onMessage: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (editing) {
    return (
      <li>
        <EntryForm
          entry={e}
          onDone={(err) => {
            setEditing(false);
            if (err) onMessage(err);
          }}
        />
      </li>
    );
  }
  return (
    <li className="feature">
      <div className="attack-name">
        <strong>{e.title}</strong>
        <span className="small muted">
          {e.sessionDate && `${formatDay(e.sessionDate)} · `}di {e.authorName}
        </span>
      </div>
      {e.body && <p className="pre-wrap">{e.body}</p>}
      {canEdit &&
        (confirmDelete ? (
          <div className="row" role="group" aria-label="Conferma eliminazione">
            <span className="small">Eliminare «{e.title}»?</span>
            <button type="button" className="danger" autoFocus onClick={async () => onMessage((await deleteLogEntry(e.id)) ?? 'Voce eliminata.')}>
              Elimina
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Annulla
            </button>
          </div>
        ) : (
          <div className="row">
            <button type="button" className="ghost" onClick={() => setEditing(true)}>
              Modifica
            </button>
            <button type="button" className="ghost" onClick={() => setConfirmDelete(true)}>
              Elimina
            </button>
          </div>
        ))}
    </li>
  );
}

export function SessionLog({ myUid, isDm }: { myUid: string; isDm: boolean }) {
  const log = usePartyStore((s) => s.log);
  const older = usePartyStore((s) => s.olderLog);
  const olderDone = usePartyStore((s) => s.olderDone);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  // Older pages are fetched once; drop any that the live list now covers.
  const entries = [...log, ...older.filter((o) => !log.some((l) => l.id === o.id))];
  const mayHaveMore = !olderDone && log.length >= LOG_PAGE;

  return (
    <section className="card stack" aria-labelledby="log-title">
      <h2 id="log-title">Diario delle sessioni</h2>
      {adding ? (
        <EntryForm
          onDone={(err) => {
            setAdding(false);
            setMessage(err ?? '');
          }}
        />
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)}>
            Scrivi una voce
          </button>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="muted">Il diario è vuoto: racconta com’è andata l’ultima sessione.</p>
      ) : (
        <ul className="list">
          {entries.map((e) => (
            <Entry key={e.id} e={e} canEdit={e.authorUid === myUid || isDm} onMessage={setMessage} />
          ))}
        </ul>
      )}
      {mayHaveMore && (
        <div>
          <button type="button" className="ghost" onClick={async () => setMessage((await loadOlderLog()) ?? '')}>
            Mostra le voci precedenti
          </button>
        </div>
      )}
      <p className="small muted status-line" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
