import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { FoldCard } from '../../components/FoldCard';
import { NumberField } from '../../components/NumberField';
import { addBestiaryEntry, patchBestiaryEntry, removeBestiaryEntry, setBestiaryReveal, useBestiaryStore, watchBestiary } from '../../data/bestiaryStore';
import { ensureMonsterCatalogue, useMonsterCatalogue } from '../../data/monsterCatalogue';
import {
  BESTIARY_LIMITS,
  completeness,
  entryNumber,
  REVEAL_LABELS,
  revealableSections,
  typeLabel,
  type BestiaryEntry,
  type Monster,
} from '../../domain/bestiary';
import { formatNumber } from '../../domain/format/number';
import { MonsterBlock } from './MonsterBlock';

/** A creature shape, black while nothing is known about it. */
function CreatureArt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 2c0 3 1 5 3 6.2C6 9.2 5 10.5 5 12.5c0 4.5 3 9 7 9s7-4.500 7-9c0-2-1-3.300-2-4.300C19 7 20 5 20 2c-2 1-4 2-5.500 3h-5C8 4 6 3 4 2zM9.500 12a1.300 1.300 0 1 0 0 .01zM14.500 12a1.300 1.300 0 1 0 0 .01z" fillRule="evenodd" />
    </svg>
  );
}

/** What the party knows about a creature that is not in the SRD: three facts typed by hand. */
function CustomBlock({ entry }: { entry: BestiaryEntry }) {
  const has = (s: 'ac' | 'hp' | 'speed') => entry.revealed.includes(s);
  const line = (label: string, known: boolean, value: string) => (
    <p className={`block-line${known ? '' : ' unknown'}`}>
      <strong>{label}</strong> {known ? value || '—' : <span aria-label="sconosciuto">???</span>}
    </p>
  );
  return (
    <div className="monster-block stack">
      {entry.creatureType && <p className="small muted">{entry.creatureType}</p>}
      {line('Classe armatura', has('ac'), entry.custom.ac === null ? '' : String(entry.custom.ac))}
      {line('Punti ferita', has('hp'), entry.custom.hp)}
      {line('Velocità', has('speed'), entry.custom.speed)}
    </div>
  );
}

/** One creature in detail: what the party has learned, the stat block it allows, notes, and deleting. */
function EntryDialog({ pid, entry, monster, canDelete, onClose }: { pid: string; entry: BestiaryEntry; monster: Monster | undefined; canDelete: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [place, setPlace] = useState(entry.place);
  const [notes, setNotes] = useState(entry.notes);
  const [type, setType] = useState(entry.creatureType);
  const [hp, setHp] = useState(entry.custom.hp);
  const [speed, setSpeed] = useState(entry.custom.speed);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');
  const ids = { place: useId(), notes: useId(), type: useId(), hp: useId(), speed: useId() };
  const sections = revealableSections(entry, monster);
  const patch = async (p: Parameters<typeof patchBestiaryEntry>[2]) => {
    const err = await patchBestiaryEntry(pid, entry.id, p);
    if (err) setMessage(err);
  };

  /** Writes what was typed and not yet saved (a field is saved when it loses focus, and again here for Escape). */
  const flush = () => {
    const changes: Parameters<typeof patchBestiaryEntry>[2] = {};
    if (place !== entry.place) changes.place = place;
    if (notes !== entry.notes) changes.notes = notes;
    if (!entry.srdId) {
      if (type !== entry.creatureType) changes.creatureType = type;
      if (hp !== entry.custom.hp || speed !== entry.custom.speed) changes.custom = { ...entry.custom, hp, speed };
    }
    if (Object.keys(changes).length > 0) void patchBestiaryEntry(pid, entry.id, changes);
  };

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} className="spell-dialog monster-dialog" aria-labelledby="entry-title" onClose={() => {
        flush();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="entry-title" style={{ margin: 0 }}>
            {entry.name}
          </h2>
          <button type="button" onClick={() => ref.current?.close()} autoFocus>
            Chiudi
          </button>
        </div>
        <p className="small muted">
          Aggiunta da {entry.createdByName || 'un compagno'}
          {monster ? ` · ${typeLabel(monster.type)}` : ''}
        </p>

        <fieldset className="plain stack">
          <legend className="label">Cosa sa il gruppo (segna quello che il DM vi ha detto)</legend>
          <div className="reveal-grid">
            {sections.map((s) => (
              <label key={s} className="inline">
                <input type="checkbox" checked={entry.revealed.includes(s)} onChange={() => void setBestiaryReveal(pid, entry.id, s, !entry.revealed.includes(s)).then((err) => err && setMessage(err))} />
                {REVEAL_LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>

        {entry.srdId ? (
          monster ? (
            <MonsterBlock monster={monster} revealed={entry.revealed} />
          ) : (
            <p className="muted">Carico la scheda della creatura…</p>
          )
        ) : (
          <>
            <CustomBlock entry={entry} />
            <div className="form-grid">
              <div className="field">
                <label htmlFor={ids.type}>Che creatura è</label>
                <input id={ids.type} value={type} maxLength={BESTIARY_LIMITS.customText} onChange={(e) => setType(e.target.value)} onBlur={() => type !== entry.creatureType && void patch({ creatureType: type })} />
              </div>
              <NumberField label="Classe armatura" value={entry.custom.ac ?? 10} min={0} max={40} onCommit={(ac) => void patch({ custom: { ...entry.custom, ac } })} />
              <div className="field">
                <label htmlFor={ids.hp}>Punti ferita</label>
                <input id={ids.hp} value={hp} maxLength={BESTIARY_LIMITS.customText} onChange={(e) => setHp(e.target.value)} onBlur={() => hp !== entry.custom.hp && void patch({ custom: { ...entry.custom, hp } })} />
              </div>
              <div className="field">
                <label htmlFor={ids.speed}>Velocità</label>
                <input id={ids.speed} value={speed} maxLength={BESTIARY_LIMITS.customText} onChange={(e) => setSpeed(e.target.value)} onBlur={() => speed !== entry.custom.speed && void patch({ custom: { ...entry.custom, speed } })} />
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor={ids.place}>Dove l’avete incontrata</label>
          <input id={ids.place} value={place} maxLength={BESTIARY_LIMITS.place} onChange={(e) => setPlace(e.target.value)} onBlur={() => place !== entry.place && void patch({ place })} />
        </div>
        <div className="field">
          <label htmlFor={ids.notes}>Appunti del gruppo</label>
          <textarea id={ids.notes} rows={4} value={notes} maxLength={BESTIARY_LIMITS.notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== entry.notes && void patch({ notes })} />
        </div>

        {message && (
          <p className="error" role="alert">
            {message}
          </p>
        )}
        {canDelete &&
          (confirmDelete ? (
            <div className="row" role="group" aria-label="Conferma">
              <span className="small">Togliere «{entry.name}» dal bestiario del gruppo?</span>
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  const err = await removeBestiaryEntry(pid, entry.id);
                  if (err) setMessage(err);
                  else onClose();
                }}
              >
                Elimina
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                Annulla
              </button>
            </div>
          ) : (
            <div>
              <button type="button" className="ghost" onClick={() => setConfirmDelete(true)}>
                Elimina dal bestiario
              </button>
            </div>
          ))}
      </div>
    </dialog>
  );
}

/**
 * The party's bestiary, a Pokédex of the campaign: it starts empty, a creature is added when the group meets it,
 * and the group marks what it has learned. Everyone in the party can add and fill in; the author or the DM deletes.
 */
export function PartyBestiary({ pid, uid, isDm }: { pid: string; uid: string; isDm: boolean }) {
  const entries = useBestiaryStore((s) => s.entries);
  const failed = useBestiaryStore((s) => s.failed);
  const { monsters, byId } = useMonsterCatalogue();
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [message, setMessage] = useState('');
  const listId = useId();

  useEffect(() => {
    ensureMonsterCatalogue();
    return watchBestiary(pid);
  }, [pid]);

  const list = useMemo(() => {
    const numbered = (e: BestiaryEntry) => entryNumber(e, monsters) ?? Number.MAX_SAFE_INTEGER;
    return [...(entries ?? [])].sort((a, b) => numbered(a) - numbered(b) || a.createdAt - b.createdAt);
  }, [entries, monsters]);
  const open = list.find((e) => e.id === openId) ?? null;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const typed = name.trim().toLowerCase();
    const srd = monsters.find((m) => m.name.toLowerCase() === typed);
    const err = await addBestiaryEntry(pid, { name: srd?.name ?? name, srdId: srd?.id ?? null, place }, entries ?? []);
    setMessage(err ?? (srd ? `«${srd.name}» aggiunto al bestiario.` : `«${name.trim()}» aggiunto: non è nell’elenco SRD, i dati si scrivono a mano.`));
    if (!err) {
      setName('');
      setPlace('');
    }
  };

  return (
    <FoldCard id="party-bestiary" title="Bestiario del gruppo" summary={entries ? `${formatNumber(entries.length)} creature` : undefined} className="span-all">
      <p className="small muted">
        Parte vuoto e si riempie giocando: aggiungi una creatura quando la incontrate, poi segna cosa ne sapete man mano che il DM lo
        rivela. Finché non sai niente se ne vede solo la sagoma. L’elenco completo dei mostri è nel tab Bestiario.
      </p>

      <form className="row bestiary-add" onSubmit={(e) => void add(e)}>
        <div className="field grow">
          <label htmlFor={`${listId}-name`}>Creatura</label>
          <input id={`${listId}-name`} list={listId} value={name} maxLength={BESTIARY_LIMITS.name} onChange={(e) => setName(e.target.value)} placeholder="Gnoll, o un nome tutto vostro" autoComplete="off" />
          <datalist id={listId}>
            {monsters.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        </div>
        <div className="field grow">
          <label htmlFor={`${listId}-place`}>Dove (facoltativo)</label>
          <input id={`${listId}-place`} value={place} maxLength={BESTIARY_LIMITS.place} onChange={(e) => setPlace(e.target.value)} />
        </div>
        <button type="submit" className="primary" disabled={!name.trim()}>
          Aggiungi
        </button>
      </form>
      <p className="status-line small" role="status" aria-live="polite">
        {message}
      </p>

      {failed && (
        <p className="red" role="alert">
          Non riesco a leggere il bestiario: controlla la connessione.
        </p>
      )}
      {entries === null && !failed && <p className="muted">Apro il bestiario…</p>}
      {entries !== null && list.length === 0 && <p className="muted">Nessuna creatura ancora: il primo mostro che incontrate sarà il numero uno.</p>}

      <ul className="plain dex-grid">
        {list.map((e) => {
          const monster = e.srdId ? byId.get(e.srdId) : undefined;
          const { known, total } = completeness(e, monster);
          const number = entryNumber(e, monsters);
          return (
            <li key={e.id}>
              <button type="button" className={`dex-card${known === 0 ? ' silhouette' : ''}`} onClick={() => setOpenId(e.id)} aria-label={`${e.name}: ${known} informazioni su ${total}`}>
                <span className="dex-number">{number ? `N° ${String(number).padStart(3, '0')}` : 'N° —'}</span>
                <span className="dex-art">
                  <CreatureArt />
                </span>
                <span className="dex-name">{e.name}</span>
                <span className="dex-progress" aria-hidden="true">
                  <span style={{ width: `${total === 0 ? 0 : (known / total) * 100}%` }} />
                </span>
                <span className="small muted">
                  {known}/{total}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {open && <EntryDialog key={open.id} pid={pid} entry={open} monster={open.srdId ? byId.get(open.srdId) : undefined} canDelete={open.createdBy === uid || isDm} onClose={() => setOpenId(null)} />}
    </FoldCard>
  );
}
