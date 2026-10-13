import { useState } from 'react';
import { TextField } from '../../components/TextField';
import { deleteQuest, loadClosedQuests, saveQuest, usePartyStore } from '../../data/partyStore';
import { TEXT_LIMITS, type Quest, type QuestStatus } from '../../domain/party';

const STATUS_LABEL: Record<QuestStatus, string> = { active: 'Attiva', completed: 'Completata', failed: 'Fallita' };

function QuestForm({ quest, onDone }: { quest?: Quest; onDone: (err: string | null) => void }) {
  const [title, setTitle] = useState(quest?.title ?? '');
  const [description, setDescription] = useState(quest?.description ?? '');
  return (
    <form
      className="stack attack-edit"
      onSubmit={async (e) => {
        e.preventDefault();
        if (title.trim() === '') return;
        onDone(await saveQuest({ id: quest?.id, title: title.trim(), description: description.trim(), status: quest?.status ?? 'active' }));
      }}
    >
      <TextField label="Titolo" value={title} maxLength={TEXT_LIMITS.questTitle} onChange={setTitle} />
      <TextField label="Descrizione" multiline value={description} maxLength={TEXT_LIMITS.questText} onChange={setDescription} />
      <div className="row">
        <button type="submit" className="primary" disabled={title.trim() === ''}>
          {quest ? 'Salva' : 'Aggiungi la missione'}
        </button>
        <button type="button" onClick={() => onDone(null)}>
          Annulla
        </button>
      </div>
    </form>
  );
}

function QuestItem({ q, isDm, onMessage }: { q: Quest; isDm: boolean; onMessage: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const setStatus = async (status: QuestStatus) => onMessage((await saveQuest({ ...q, status })) ?? `«${q.title}»: ${STATUS_LABEL[status].toLowerCase()}.`);

  if (editing) {
    return (
      <li>
        <QuestForm
          quest={q}
          onDone={(err) => {
            setEditing(false);
            if (err) onMessage(err);
          }}
        />
      </li>
    );
  }
  return (
    <li className={`feature quest ${q.status}`}>
      <div className="attack-name">
        <strong>{q.title}</strong>
        {q.status !== 'active' && <span className={`result-tag ${q.status === 'completed' ? 'crit' : 'fumble'}`}>{STATUS_LABEL[q.status]}</span>}
      </div>
      {q.description && <p className="small pre-wrap">{q.description}</p>}
      {isDm &&
        (confirmDelete ? (
          <div className="row" role="group" aria-label="Conferma eliminazione">
            <span className="small">Eliminare «{q.title}»?</span>
            <button type="button" className="danger" autoFocus onClick={async () => onMessage((await deleteQuest(q.id)) ?? 'Missione eliminata.')}>
              Elimina
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Annulla
            </button>
          </div>
        ) : (
          <div className="row">
            {q.status === 'active' ? (
              <>
                <button type="button" className="heal" onClick={() => void setStatus('completed')}>
                  Completata
                </button>
                <button type="button" className="danger" onClick={() => void setStatus('failed')}>
                  Fallita
                </button>
              </>
            ) : (
              <button type="button" onClick={() => void setStatus('active')}>
                Riapri
              </button>
            )}
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

export function QuestBoard({ isDm }: { isDm: boolean }) {
  const quests = usePartyStore((s) => s.quests);
  const closed = usePartyStore((s) => s.closedQuests);
  const [showClosed, setShowClosed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  return (
    <section className="card stack" aria-labelledby="quests-title">
      <h2 id="quests-title">Missioni</h2>
      {quests.length === 0 ? (
        <p className="muted">{isDm ? 'Nessuna missione attiva: aggiungine una per il gruppo.' : 'Nessuna missione attiva per ora.'}</p>
      ) : (
        <ul className="list">
          {quests.map((q) => (
            <QuestItem key={q.id} q={q} isDm={isDm} onMessage={setMessage} />
          ))}
        </ul>
      )}
      {isDm &&
        (adding ? (
          <QuestForm
            onDone={(err) => {
              setAdding(false);
              setMessage(err ?? '');
            }}
          />
        ) : (
          <div>
            <button type="button" onClick={() => setAdding(true)}>
              Aggiungi una missione
            </button>
          </div>
        ))}
      <details
        open={showClosed}
        onToggle={(e) => {
          const open = (e.target as HTMLDetailsElement).open;
          setShowClosed(open);
          if (open && closed === null) void loadClosedQuests().then((err) => err && setMessage(err));
        }}
      >
        <summary className="small muted">Completate e fallite</summary>
        {closed === null ? (
          <p className="small muted">Carico…</p>
        ) : closed.length === 0 ? (
          <p className="small muted">Nessuna missione conclusa.</p>
        ) : (
          <ul className="list" style={{ marginTop: 'var(--space-2)' }}>
            {closed.map((q) => (
              <QuestItem key={q.id} q={q} isDm={isDm} onMessage={setMessage} />
            ))}
          </ul>
        )}
      </details>
      <p className="small muted status-line" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
