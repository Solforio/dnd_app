import { useId, useState } from 'react';
import { Link } from 'react-router';
import { TextField } from '../../components/TextField';
import { PIN_KIND_LABELS, PIN_KINDS, TEXT, type GameMap, type MapPin, type PinKind } from '../../domain/maps';

interface Props {
  pin: MapPin;
  isNew: boolean;
  canEdit: boolean;
  maps: GameMap[];
  mapId: string;
  linkTo: (mapId: string) => string;
  onSave: (pin: MapPin) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Details of the selected pin; an editable form for its author (or the DM, or on personal maps). */
export function PinPanel({ pin, isNew, canEdit, maps, mapId, linkTo, onSave, onDelete, onClose }: Props) {
  const kindId = useId();
  const linkId = useId();
  const [editing, setEditing] = useState(isNew);
  const [draft, setDraft] = useState(pin);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const linked = maps.find((m) => m.id === pin.linkMapId);
  const others = maps.filter((m) => m.id !== mapId).sort((a, b) => a.name.localeCompare(b.name, 'it'));

  if (editing) {
    return (
      <form
        className="card stack pin-panel"
        aria-label={isNew ? 'Nuovo segnalino' : `Modifica ${pin.title}`}
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...draft, title: draft.title.trim() || 'Segnalino' });
          setEditing(false);
        }}
      >
        <TextField label="Titolo" value={draft.title} maxLength={TEXT.pinTitle} placeholder="Phandalin" onChange={(title) => setDraft({ ...draft, title })} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor={kindId}>Tipo</label>
            <select id={kindId} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as PinKind })}>
              {PIN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PIN_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={linkId}>Apre la mappa</label>
            <select id={linkId} value={draft.linkMapId ?? ''} onChange={(e) => setDraft({ ...draft, linkMapId: e.target.value || null })}>
              <option value="">Nessuna</option>
              {others.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <TextField label="Nota" multiline value={draft.note} maxLength={TEXT.pinNote} onChange={(note) => setDraft({ ...draft, note })} />
        <div className="row">
          <button type="submit" className="primary">
            Salva
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(pin);
              setEditing(false);
              if (isNew) onClose();
            }}
          >
            Annulla
          </button>
        </div>
      </form>
    );
  }

  return (
    <section className="card stack pin-panel" aria-label={`Segnalino ${pin.title}`}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0 }}>{pin.title}</h3>
          <span className="small muted">
            {PIN_KIND_LABELS[pin.kind]}
            {pin.authorName && ` · di ${pin.authorName}`}
          </span>
        </div>
        <button type="button" className="ghost" aria-label="Chiudi il segnalino" onClick={onClose}>
          ✕
        </button>
      </div>
      {pin.note && <p className="pre-wrap">{pin.note}</p>}
      {pin.linkMapId &&
        (linked ? (
          <Link className="button-link" to={linkTo(linked.id)}>
            Apri «{linked.name}»
          </Link>
        ) : (
          <p className="small muted">La mappa collegata non esiste più.</p>
        ))}
      {canEdit &&
        (confirmDelete ? (
          <div className="row" role="group" aria-label="Conferma eliminazione">
            <span className="small">Eliminare «{pin.title}»?</span>
            <button type="button" className="danger" autoFocus onClick={onDelete}>
              Elimina
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Annulla
            </button>
          </div>
        ) : (
          <div className="row">
            <button type="button" onClick={() => setEditing(true)}>
              Modifica
            </button>
            <button type="button" className="ghost danger-text" onClick={() => setConfirmDelete(true)}>
              Elimina
            </button>
          </div>
        ))}
    </section>
  );
}
