import { useState } from 'react';
import { acceptUpload, dismissUpload, useSession, type ConflictChoice } from '../../data/session';

const dateFormat = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const when = (ms: number) => (ms > 0 ? dateFormat.format(new Date(ms)) : 'data sconosciuta');

/** Offered once per login when this device holds characters the account does not have. */
export function UploadDialog() {
  const offer = useSession((s) => s.uploadOffer);
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({});
  if (!offer) return null;

  const total = offer.fresh.length + offer.conflicts.length;
  const choose = (id: string, c: ConflictChoice) => setChoices((s) => ({ ...s, [id]: c }));
  const allChosen = offer.conflicts.every((c) => choices[c.local.id]);

  return (
    <section className="card stack upload" aria-labelledby="upload-title" role="region">
      <h2 id="upload-title">Personaggi su questo dispositivo</h2>
      <p>
        Su questo dispositivo ci {total === 1 ? 'è un personaggio' : `sono ${total} personaggi`} che non{' '}
        {total === 1 ? 'è' : 'sono'} nel tuo account. Vuoi caricarli? La copia sul dispositivo resta comunque.
      </p>
      {offer.fresh.length > 0 && (
        <ul className="small">
          {offer.fresh.map((c) => (
            <li key={c.id}>{c.name}</li>
          ))}
        </ul>
      )}

      {offer.conflicts.map(({ local, cloud }) => (
        <fieldset key={local.id} className="stack conflict">
          <legend>«{local.name}» esiste già nell’account, con dati diversi:</legend>
          <label className="row">
            <input
              type="radio"
              name={`conflict-${local.id}`}
              checked={choices[local.id] === 'cloud'}
              onChange={() => choose(local.id, 'cloud')}
            />
            Tieni quella dell’account (modificata {when(cloud.updatedAt)})
          </label>
          <label className="row">
            <input
              type="radio"
              name={`conflict-${local.id}`}
              checked={choices[local.id] === 'local'}
              onChange={() => choose(local.id, 'local')}
            />
            Sostituisci con quella del dispositivo (modificata {when(local.updatedAt)})
          </label>
        </fieldset>
      ))}

      <div className="row">
        <button type="button" className="primary" disabled={!allChosen} onClick={() => acceptUpload(choices)}>
          Carica sul mio account
        </button>
        <button type="button" onClick={() => dismissUpload(false)}>
          Non ora
        </button>
        <button type="button" className="ghost" onClick={() => dismissUpload(true)}>
          Non chiedere più su questo dispositivo
        </button>
      </div>
      {!allChosen && <p className="small muted">Scegli quale versione tenere per ogni personaggio in conflitto.</p>}
    </section>
  );
}
