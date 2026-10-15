import { Hint } from '../../components/Hint';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { TextField } from '../../components/TextField';
import {
  createMaps,
  deleteMap,
  ensurePersonalMaps,
  replaceImage,
  updateMap,
  useMapStore,
  watchPartyMaps,
  type MapScope,
} from '../../data/mapStore';
import { usePartyStore } from '../../data/partyStore';
import { useSession } from '../../data/session';
import { canNest, MAP_LIMIT, mapTree, TEXT, type GameMap } from '../../domain/maps';
import { mapPath } from './mapPaths';

function ParentSelect({ label, maps, value, exclude, onChange }: { label: string; maps: GameMap[]; value: string | null; exclude?: string; onChange: (id: string | null) => void }) {
  const id = useId();
  const options = mapTree(maps).filter(({ map }) => !exclude || canNest(maps, exclude, map.id));
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Nessuna (mappa principale)</option>
        {options.map(({ map, depth }) => (
          <option key={map.id} value={map.id}>
            {'— '.repeat(depth)}
            {map.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function MapEditor({ scope, map, maps, onDone }: { scope: MapScope; map: GameMap; maps: GameMap[]; onDone: (msg: string) => void }) {
  const [name, setName] = useState(map.name);
  const [parentId, setParentId] = useState(map.parentId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const children = maps.filter((m) => m.parentId === map.id).length;

  return (
    <div className="stack attack-edit">
      <div className="form-grid">
        <TextField label="Nome" value={name} maxLength={TEXT.mapName} onChange={setName} />
        <ParentSelect label="Dentro a" maps={maps} value={parentId} exclude={map.id} onChange={setParentId} />
      </div>
      <div className="row">
        <button
          type="button"
          className="primary"
          onClick={async () => {
            const err = await updateMap(scope, map.id, { name: name.trim() || map.name, parentId });
            onDone(err ?? 'Mappa salvata.');
          }}
        >
          Salva
        </button>
        <button type="button" onClick={() => file.current?.click()}>
          Sostituisci l’immagine
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          aria-label="Nuova immagine della mappa"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onDone((await replaceImage(scope, map.id, f)) ?? 'Immagine sostituita: i segnalini restano nella stessa posizione relativa.');
          }}
        />
        <button type="button" onClick={() => onDone('')}>
          Annulla
        </button>
      </div>
      {confirmDelete ? (
        <div className="row" role="group" aria-label="Conferma eliminazione">
          <span className="small">
            Eliminare «{map.name}» con tutti i suoi segnalini?{children > 0 && ` Le ${children} sottomappe diventano mappe principali.`}
          </span>
          <button type="button" className="danger" autoFocus onClick={async () => onDone((await deleteMap(scope, map.id)) ?? `Mappa «${map.name}» eliminata.`)}>
            Elimina
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)}>
            Annulla
          </button>
        </div>
      ) : (
        <div>
          <button type="button" className="ghost danger-text" onClick={() => setConfirmDelete(true)}>
            Elimina la mappa
          </button>
        </div>
      )}
    </div>
  );
}

/** List of maps for one scope (mine or a party's), as a tree, plus creation from image files. */
export function MapsPage() {
  const phase = useSession((s) => s.phase);
  const memberships = usePartyStore((s) => s.memberships);
  const scopeName = useId();
  const [scopeKey, setScopeKey] = useState('personal');
  const pid = scopeKey === 'personal' ? null : scopeKey;
  const scope: MapScope = pid ? { kind: 'party', pid } : { kind: 'personal' };
  const maps = useMapStore((s) => (pid ? s.party[pid] : s.personal));
  const isDm = !pid || memberships?.find((m) => m.partyId === pid)?.role === 'dm';
  const [parentId, setParentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const files = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pid) void ensurePersonalMaps();
    else if (phase === 'cloud') return watchPartyMaps(pid);
  }, [pid, phase]);

  const add = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    setMessage(`Preparo ${list.length === 1 ? 'l’immagine' : `${list.length} immagini`}…`);
    const result = await createMaps(scope, [...list], parentId);
    setBusy(false);
    setMessage(
      [result.created.length > 0 && `Aggiunte ${result.created.length} mappe: ${result.created.map((m) => m.name).join(', ')}.`, ...result.errors]
        .filter(Boolean)
        .join(' '),
    );
  };

  return (
    <main className="app-main single">
      {phase === 'cloud' && memberships && memberships.length > 0 && (
        <fieldset className="segmented scope-switch">
          <legend className="visually-hidden">Quali mappe</legend>
          {[{ key: 'personal', label: 'Le mie mappe' }, ...memberships.map((m) => ({ key: m.partyId, label: `Gruppo: ${m.name || 'gruppo'}` }))].map((s) => (
            <label key={s.key}>
              <input
                type="radio"
                name={scopeName}
                checked={scopeKey === s.key}
                onChange={() => {
                  setScopeKey(s.key);
                  setParentId(null);
                  setEditing(null);
                  setMessage('');
                }}
              />
              {s.label}
            </label>
          ))}
        </fieldset>
      )}

      <section className="card stack" aria-labelledby="maps-title">
        <h2 id="maps-title">{pid ? 'Mappe del gruppo' : 'Le mie mappe'}</h2>
        <Hint short={pid ? 'Le crea il DM; tutti aggiungono segnalini.' : 'Solo tu le vedi.'}>
          {pid
            ? 'Le crea il DM; tutti i membri vedono e aggiungono segnalini. Ognuno carica l’immagine sul proprio dispositivo: il DM può mandarvi lo stesso file.'
            : 'Solo tu le vedi. I segnalini si salvano sul tuo account (o in questo browser se non hai accesso).'}{' '}
          Le immagini restano su questo dispositivo e non vengono mai inviate a internet.
        </Hint>
        {maps === null || maps === undefined ? (
          <p className="muted" role="status">
            Carico le mappe…
          </p>
        ) : maps.length === 0 ? (
          <p className="muted">{isDm ? 'Nessuna mappa: aggiungi un’immagine, per esempio la mappa del Faerûn.' : 'Il DM non ha ancora aggiunto mappe.'}</p>
        ) : (
          <ul className="list">
            {mapTree(maps).map(({ map, depth }) => (
              <li key={map.id} style={{ marginLeft: `${depth * 1.25}rem` }}>
                {editing === map.id ? (
                  <MapEditor
                    scope={scope}
                    map={map}
                    maps={maps}
                    onDone={(msg) => {
                      setEditing(null);
                      setMessage(msg);
                    }}
                  />
                ) : (
                  <div className="map-row">
                    <Link to={mapPath(scope, map.id)} className="map-link">
                      {depth > 0 && <span aria-hidden="true">↳ </span>}
                      {map.name}
                    </Link>
                    {isDm && (
                      <button type="button" className="ghost" onClick={() => setEditing(map.id)}>
                        Modifica<span className="visually-hidden"> {map.name}</span>
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isDm && maps && (
        <section className="card stack" aria-labelledby="new-map-title">
          <h2 id="new-map-title">Aggiungi mappe</h2>
          <p className="small muted">
            Scegli una o più immagini: ognuna diventa una mappa con il nome del file. Puoi metterle dentro un’altra mappa (per esempio le
            città dentro il Faerûn) e poi collegarle con un segnalino «Città».
          </p>
          <ParentSelect label="Dentro a" maps={maps} value={parentId} onChange={setParentId} />
          <div>
            <button type="button" className="primary" disabled={busy || maps.length >= MAP_LIMIT} onClick={() => files.current?.click()}>
              Scegli le immagini
            </button>
            <input
              ref={files}
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-label="Immagini delle mappe"
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </section>
      )}
      <p className="small muted status-line" role="status" aria-live="polite">
        {message}
      </p>
    </main>
  );
}
