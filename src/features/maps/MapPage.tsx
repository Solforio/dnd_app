import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { getFirebase } from '../../data/firebase';
import { fingerprintOf, prepareImage, putImage } from '../../data/imageStore';
import { downloadAccountImage } from '../../data/imageSync';
import {
  ensurePersonalMaps,
  removePin,
  savePin,
  useMapStore,
  watchPartyMaps,
  watchPartyPins,
  type MapScope,
} from '../../data/mapStore';
import { usePartyStore } from '../../data/partyStore';
import { useSession } from '../../data/session';
import { newId } from '../../domain/character';
import { breadcrumb, PIN_KIND_LABELS, type MapPin } from '../../domain/maps';
import { mapPath } from './mapPaths';
import { MapViewer } from './MapViewer';
import { ImageSyncControl } from './ImageSyncControl';
import { PinPanel } from './PinPanel';
import { useMapImage } from './useMapImage';

/** Loading the image on a device that does not have it yet (or a member's copy of the DM's file). */
function MissingImage({ fingerprint, onLoaded }: { fingerprint: string; onLoaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const phase = useSession((s) => s.phase);
  const user = useSession((s) => s.user);
  // Logged in: the user's own copy may be in the account, so look there before asking for the file.
  const [searched, setSearched] = useState(false);
  const canSearch = phase === 'cloud' && user !== null;
  const searching = canSearch && !searched;

  useEffect(() => {
    const fb = canSearch ? getFirebase() : null;
    if (!fb || !user) return;
    let cancelled = false;
    downloadAccountImage(fb.db, user.uid, fingerprint)
      .then((found) => {
        if (cancelled) return;
        if (found) onLoaded();
        else setSearched(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setMessage(e instanceof Error ? e.message : '');
        setSearched(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, canSearch, user]);

  const store = async (file: File, asFingerprint?: string) => {
    try {
      const img = await prepareImage(file);
      await putImage(asFingerprint ? { ...img, fingerprint: asFingerprint } : img);
      onLoaded();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Non riesco a leggere il file.');
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setMessage('Controllo l’immagine…');
    if ((await fingerprintOf(file)) === fingerprint) await store(file);
    else {
      setMessage('');
      setPending(file);
    }
  };

  if (searching) {
    return (
      <div className="card stack map-missing" role="status">
        <p>Cerco l’immagine nel tuo account…</p>
      </div>
    );
  }

  return (
    <div className="card stack map-missing">
      <h3>L’immagine di questa mappa non è su questo dispositivo</h3>
      <p className="small">
        Le immagini restano nel browser di chi le carica (non vengono mai inviate a internet). Scegli lo stesso file usato per creare la
        mappa: se sei in un gruppo, chiedilo al DM.
      </p>
      {pending ? (
        <div className="row" role="group" aria-label="Immagine diversa">
          <span className="small">
            «{pending.name}» non è lo stesso file: se è un’altra versione della mappa, i segnalini potrebbero non coincidere.
          </span>
          <button type="button" className="primary" onClick={() => void store(pending, fingerprint)}>
            Usala comunque
          </button>
          <button type="button" onClick={() => setPending(null)}>
            Annulla
          </button>
        </div>
      ) : (
        <div>
          <button type="button" className="primary" onClick={() => input.current?.click()}>
            Scegli l’immagine
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            aria-label="Immagine della mappa"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      )}
      <p className="small muted" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}

export function MapPage({ scope: kind }: { scope: 'personal' | 'party' }) {
  const params = useParams();
  const mapId = params.mapId ?? '';
  const pid = params.partyId ?? '';
  const scope: MapScope = kind === 'personal' ? { kind: 'personal' } : { kind: 'party', pid };
  const [search] = useSearchParams();
  const user = useSession((s) => s.user);
  const phase = useSession((s) => s.phase);
  const maps = useMapStore((s) => (kind === 'personal' ? s.personal : s.party[pid]));
  const partyPins = useMapStore((s) => s.partyPins);
  const isDm = usePartyStore((s) => s.memberships?.find((m) => m.partyId === pid)?.role === 'dm');
  const [reload, setReload] = useState(0);
  const [addMode, setAddMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<MapPin | null>(null);
  const [message, setMessage] = useState('');
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (kind === 'personal') void ensurePersonalMaps();
    else if (phase === 'cloud') return watchPartyMaps(pid);
  }, [kind, pid, phase]);

  useEffect(() => {
    if (kind === 'party' && phase === 'cloud') return watchPartyPins(pid, mapId);
  }, [kind, pid, mapId, phase]);

  const map = maps?.find((m) => m.id === mapId);
  const image = useMapImage(map?.fingerprint, reload);

  if (maps === null || maps === undefined) {
    return (
      <main className="app-main single">
        <p className="muted" role="status">
          Apro la mappa…
        </p>
      </main>
    );
  }
  if (!map) {
    return (
      <main className="app-main single">
        <section className="card stack">
          <h2>Mappa non trovata</h2>
          <p>Forse è stata eliminata.</p>
          <Link to="/mappe">Torna alle mappe</Link>
        </section>
      </main>
    );
  }

  const pins: MapPin[] = kind === 'personal' ? ('pins' in map ? (map.pins as MapPin[]) : []) : partyPins;
  const shown = draft ? [...pins.filter((p) => p.id !== draft.id), draft] : pins;
  const current = draft ?? pins.find((p) => p.id === selected) ?? null;
  const canEdit = (p: MapPin) => kind === 'personal' || p.authorUid === user?.uid || isDm;
  const trail = breadcrumb(maps, map.id);
  const cameFrom = search.get('da');
  const focusPinId = cameFrom ? pins.find((p) => p.linkMapId === cameFrom)?.id : null;

  const report = (err: string | null, ok: string) => setMessage(err ?? ok);

  const panel = current && (
        <PinPanel
          key={current.id}
          pin={current}
          isNew={draft !== null}
          canEdit={canEdit(current)}
          maps={maps}
          mapId={map.id}
          linkTo={(id) => mapPath(scope, id)}
          onSave={async (p) => {
            report(await savePin(scope, map.id, p), `Segnalino «${p.title}» salvato.`);
            setDraft(null);
            setSelected(p.id);
          }}
          onDelete={async () => {
            report(await removePin(scope, map.id, current.id), 'Segnalino eliminato.');
            setSelected(null);
          }}
          onClose={() => {
            setDraft(null);
            setSelected(null);
          }}
        />
  );

  return (
    <main className="app-main map-layout">
      <nav className="span-all map-trail small" aria-label="Percorso delle mappe">
        <Link to="/mappe">Mappe</Link>
        {trail.map((m, i) => (
          <span key={m.id}>
            {' › '}
            {i === trail.length - 1 ? (
              <strong aria-current="page">{m.name}</strong>
            ) : (
              <Link to={`${mapPath(scope, m.id)}?da=${trail[i + 1]!.id}`}>{m.name}</Link>
            )}
          </span>
        ))}
      </nav>

      <div className="map-main">
        <div className="row map-toolbar">
          <button
            type="button"
            className={addMode ? 'primary' : undefined}
            aria-pressed={addMode}
            disabled={image.status !== 'ready'}
            onClick={() => {
              setAddMode(!addMode);
              setMessage(addMode ? '' : 'Tocca la mappa nel punto in cui vuoi il segnalino.');
            }}
          >
            {addMode ? 'Annulla aggiunta' : 'Aggiungi segnalino'}
          </button>
          <span className="small muted" role="status" aria-live="polite">
            {message}
          </span>
        </div>
        {image.status === 'ready' ? (
          <MapViewer
            url={image.url}
            image={image}
            pins={shown}
            selectedId={current?.id ?? null}
            addMode={addMode}
            focusPinId={focusPinId}
            onAdd={(at) => {
              setAddMode(false);
              setMessage('');
              setSelected(null);
              setDraft({
                id: newId(),
                ...at,
                title: '',
                note: '',
                kind: 'place',
                linkMapId: null,
                authorUid: user?.uid ?? '',
                authorName: user?.username ?? '',
                createdAt: 0,
                updatedAt: 0,
              });
            }}
            onSelect={(id) => {
              setDraft(null);
              setSelected(id);
            }}
            full={full}
            onFullChange={setFull}
            overlay={
              <>
                <div className="row">
                  <button
                    type="button"
                    className={addMode ? 'primary' : undefined}
                    aria-pressed={addMode}
                    onClick={() => {
                      setAddMode(!addMode);
                      setMessage(addMode ? '' : 'Tocca la mappa nel punto in cui vuoi il segnalino.');
                    }}
                  >
                    {addMode ? 'Annulla aggiunta' : 'Aggiungi segnalino'}
                  </button>
                </div>
                {message && (
                  <p className="small map-overlay-note" role="status">
                    {message}
                  </p>
                )}
                {panel}
              </>
            }
          />
        ) : image.status === 'missing' ? (
          <MissingImage fingerprint={map.fingerprint} onLoaded={() => setReload((r) => r + 1)} />
        ) : (
          <p className="muted">Carico l’immagine…</p>
        )}
      </div>

      <aside className="map-side stack">
        {!full && panel}
        <section className="card stack" aria-labelledby="pins-title">
          <h3 id="pins-title">Segnalini ({pins.length})</h3>
          {pins.length === 0 ? (
            <p className="small muted">Nessun segnalino: premi «Aggiungi segnalino» e tocca la mappa.</p>
          ) : (
            <ul className="list compact">
              {[...pins]
                .sort((a, b) => a.title.localeCompare(b.title, 'it'))
                .map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="check-btn"
                      aria-pressed={p.id === current?.id}
                      onClick={() => {
                        setDraft(null);
                        setSelected(p.id);
                      }}
                    >
                      <span className={`pin-dot ${p.kind}`} aria-hidden="true" />
                      <span>{p.title}</span>
                      <span className="small muted">{PIN_KIND_LABELS[p.kind]}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
        {image.status === 'ready' && <ImageSyncControl fingerprint={map.fingerprint} />}
      </aside>
    </main>
  );
}
