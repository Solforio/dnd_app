import { useId, useState } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { leaveParty, setMyCharacter, setMySharing } from '../../data/partyStore';
import {
  HP_VISIBILITIES,
  SHARED_FIELD_LABELS,
  SHARED_FIELDS,
  type HpVisibility,
  type Membership,
} from '../../domain/party';
import { CharacterSelect } from './CharacterSelect';

const HP_LABEL: Record<HpVisibility, string> = { exact: 'Esatti', status: 'Solo stato', hidden: 'Nascosti' };

/** Which character represents me here, what the others see, and leaving. */
export function MySharing({ membership, isDm, onLeft }: { membership: Membership; isDm: boolean; onLeft: () => void }) {
  const hpName = useId();
  const characterExists = useCharacterStore((s) => [s.character, ...s.others].some((c) => c.id === membership.characterId));
  const [message, setMessage] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const sharing = membership.sharing;
  const pid = membership.partyId;

  const report = (err: string | null) => setMessage(err ?? 'Salvato: gli altri vedono la tua scheda aggiornata.');

  return (
    <section className="card stack" aria-labelledby="sharing-title">
      <h2 id="sharing-title">La mia scheda nel gruppo</h2>
      {!characterExists && (
        <p className="error" role="alert">
          Il personaggio che usavi qui non esiste più: scegline un altro.
        </p>
      )}
      <CharacterSelect label="Partecipo con" value={membership.characterId} onChange={async (id) => report(await setMyCharacter(pid, id))} />

      <fieldset className="plain stack">
        <legend className="label">Punti ferita</legend>
        <div className="segmented">
          {HP_VISIBILITIES.map((v) => (
            <label key={v}>
              <input
                type="radio"
                name={hpName}
                checked={sharing.hp === v}
                onChange={async () => report(await setMySharing(pid, { ...sharing, hp: v }))}
              />
              {HP_LABEL[v]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="inline">
        <input
          type="checkbox"
          checked={sharing.portrait}
          onChange={async (e) => report(await setMySharing(pid, { ...sharing, portrait: e.target.checked }))}
        />
        Mostra il mio ritratto agli altri (non la figura intera)
      </label>

      <label className="inline">
        <input
          type="checkbox"
          checked={sharing.fullSheet}
          onChange={async (e) => report(await setMySharing(pid, { ...sharing, fullSheet: e.target.checked }))}
        />
        Mostra la mia scheda completa al Master (sola lettura: caratteristiche, attacchi, incantesimi, zaino)
      </label>

      <fieldset className="plain">
        <legend className="label">Cos’altro condividi (nome, classe e livello sono sempre visibili)</legend>
        <div className="share-grid">
          {SHARED_FIELDS.map((f) => (
            <label key={f} className="inline">
              <input
                type="checkbox"
                checked={sharing.fields[f]}
                onChange={async (e) => report(await setMySharing(pid, { ...sharing, fields: { ...sharing.fields, [f]: e.target.checked } }))}
              />
              {SHARED_FIELD_LABELS[f]}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="small muted">
        Gli altri giocatori vedono solo quello che spunti qui. La scheda completa la vede soltanto il Master, e solo se lo scegli: il
        Master non può modificarla.
      </p>

      <div className="row">
        {isDm ? (
          <p className="small muted">Per uscire dal gruppo passa prima il ruolo di DM a un altro membro, oppure elimina il gruppo.</p>
        ) : confirmLeave ? (
          <div className="row" role="group" aria-label="Conferma uscita">
            <span className="small">Uscire dal gruppo? Per rientrare servirà di nuovo il codice.</span>
            <button
              type="button"
              className="danger"
              autoFocus
              onClick={async () => {
                const err = await leaveParty(pid);
                if (err) setMessage(err);
                else onLeft();
              }}
            >
              Esci dal gruppo
            </button>
            <button type="button" onClick={() => setConfirmLeave(false)}>
              Annulla
            </button>
          </div>
        ) : (
          <button type="button" className="danger" onClick={() => setConfirmLeave(true)}>
            Esci dal gruppo
          </button>
        )}
      </div>
      <p className="small muted status-line" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
