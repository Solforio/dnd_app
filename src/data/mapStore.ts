import type { Unsubscribe } from 'firebase/firestore';
import { create } from 'zustand';
import { newId } from '../domain/character';
import { MAP_LIMIT, nameFromFile, PIN_LIMIT, type GameMap, type MapPin, type PersonalMap } from '../domain/maps';
import { getFirebase } from './firebase';
import { ImageError, prepareImage, putImage } from './imageStore';
import * as repo from './mapRepo';
import { useSession } from './session';

/**
 * Maps for the maps pages. Personal maps: loaded once per session (browser or
 * account). Party maps and the pins of an open party map: realtime, only while
 * their page is open.
 */

export type MapScope = { kind: 'personal' } | { kind: 'party'; pid: string };

interface MapState {
  /** null until loaded. */
  personal: PersonalMap[] | null;
  /** Party maps by party id; undefined until the listener delivers. */
  party: Record<string, GameMap[] | undefined>;
  /** Pins of the open party map. */
  partyPins: MapPin[];
}

export const useMapStore = create<MapState>(() => ({ personal: null, party: {}, partyPins: [] }));

const OFFLINE = 'Operazione non riuscita: controlla la connessione e riprova.';

function cloud() {
  const fb = getFirebase();
  const s = useSession.getState();
  return fb && s.user && s.phase === 'cloud' ? { db: fb.db, user: s.user } : null;
}

let personalFor: string | null = null;

useSession.subscribe((s, prev) => {
  if (s.phase !== prev.phase || s.user?.uid !== prev.user?.uid) {
    personalFor = null;
    useMapStore.setState({ personal: null, party: {}, partyPins: [] });
  }
});

/** Loads personal maps once for the current workspace. */
export async function ensurePersonalMaps(): Promise<void> {
  const s = useSession.getState();
  if (s.phase !== 'local' && s.phase !== 'cloud') return;
  const key = s.phase === 'cloud' ? (s.user?.uid ?? '') : 'local';
  if (personalFor === key) return;
  personalFor = key;
  const c = cloud();
  try {
    const maps = c ? await repo.fetchPersonalMaps(c.db, c.user.uid) : repo.loadLocalMaps();
    if (personalFor === key) useMapStore.setState({ personal: maps });
  } catch {
    personalFor = null;
    useMapStore.setState({ personal: [] });
  }
}

/** Saves one personal map (account) or the whole list (browser). */
async function persistPersonal(changed: PersonalMap | null, removedId?: string) {
  const all = useMapStore.getState().personal ?? [];
  const c = cloud();
  if (!c) {
    if (!repo.saveLocalMaps(all)) throw new Error('Il browser non permette di salvare.');
    return;
  }
  if (changed) await repo.savePersonalMap(c.db, c.user.uid, changed);
  if (removedId) await repo.deletePersonalMap(c.db, c.user.uid, removedId);
}

function setPersonal(fn: (maps: PersonalMap[]) => PersonalMap[]) {
  useMapStore.setState((s) => ({ personal: fn(s.personal ?? []) }));
}

export function mapsOf(scope: MapScope): GameMap[] | null {
  const s = useMapStore.getState();
  return scope.kind === 'personal' ? s.personal : (s.party[scope.pid] ?? null);
}

// --- Party listeners ---

export function watchPartyMaps(pid: string): Unsubscribe {
  const c = cloud();
  if (!c) return () => {};
  return repo.watchPartyMaps(
    c.db,
    pid,
    (maps) => useMapStore.setState((s) => ({ party: { ...s.party, [pid]: maps } })),
    () => useMapStore.setState((s) => ({ party: { ...s.party, [pid]: [] } })),
  );
}

export function watchPartyPins(pid: string, mapId: string): Unsubscribe {
  const c = cloud();
  if (!c) return () => {};
  useMapStore.setState({ partyPins: [] });
  return repo.watchPins(
    c.db,
    pid,
    mapId,
    (pins) => useMapStore.setState({ partyPins: pins }),
    () => useMapStore.setState({ partyPins: [] }),
  );
}

// --- Maps ---

export interface CreateResult {
  created: GameMap[];
  errors: string[];
}

/** One map per image file; the images go to this browser's storage. */
export async function createMaps(scope: MapScope, files: File[], parentId: string | null): Promise<CreateResult> {
  const result: CreateResult = { created: [], errors: [] };
  const existing = mapsOf(scope) ?? [];
  const c = cloud();
  for (const file of files) {
    if (existing.length + result.created.length >= MAP_LIMIT) {
      result.errors.push(`Puoi avere al massimo ${MAP_LIMIT} mappe qui: «${file.name}» non è stata aggiunta.`);
      continue;
    }
    try {
      const img = await prepareImage(file);
      await putImage(img);
      const now = Date.now();
      const map: GameMap = {
        id: newId(),
        name: nameFromFile(file.name),
        parentId,
        fingerprint: img.fingerprint,
        width: img.width,
        height: img.height,
        createdAt: now,
        updatedAt: now,
      };
      if (scope.kind === 'personal') {
        const personal: PersonalMap = { ...map, pins: [] };
        setPersonal((maps) => [...maps, personal]);
        await persistPersonal(personal);
      } else {
        if (!c) throw new Error(OFFLINE);
        await repo.savePartyMap(c.db, scope.pid, map, c.user.uid);
      }
      result.created.push(map);
    } catch (e) {
      result.errors.push(e instanceof ImageError ? e.message : `«${file.name}»: ${OFFLINE}`);
    }
  }
  return result;
}

async function attempt(fn: () => Promise<void>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof ImageError ? e.message : OFFLINE;
  }
}

export function updateMap(scope: MapScope, id: string, patch: Partial<Pick<GameMap, 'name' | 'parentId' | 'fingerprint' | 'width' | 'height'>>) {
  return attempt(async () => {
    const updatedAt = Date.now();
    if (scope.kind === 'personal') {
      let changed: PersonalMap | null = null;
      setPersonal((maps) =>
        maps.map((m) => {
          if (m.id !== id) return m;
          changed = { ...m, ...patch, updatedAt };
          return changed;
        }),
      );
      await persistPersonal(changed);
    } else {
      const c = cloud();
      const m = mapsOf(scope)?.find((x) => x.id === id);
      if (!c || !m) throw new Error(OFFLINE);
      await repo.savePartyMap(c.db, scope.pid, { ...m, ...patch, updatedAt }, c.user.uid);
    }
  });
}

/** Swaps the image of a map (pins keep their relative position). */
export function replaceImage(scope: MapScope, id: string, file: File) {
  return attempt(async () => {
    const img = await prepareImage(file);
    await putImage(img);
    const err = await updateMap(scope, id, { fingerprint: img.fingerprint, width: img.width, height: img.height });
    if (err) throw new Error(err);
  });
}

/** Removes a map; its sub-maps move up to the top level. Images stay cached in the browser. */
export function deleteMap(scope: MapScope, id: string) {
  return attempt(async () => {
    const children = (mapsOf(scope) ?? []).filter((m) => m.parentId === id);
    if (scope.kind === 'personal') {
      setPersonal((maps) => maps.filter((m) => m.id !== id));
      await persistPersonal(null, id);
      for (const child of children) await updateMap(scope, child.id, { parentId: null });
    } else {
      const c = cloud();
      if (!c) throw new Error(OFFLINE);
      for (const child of children) await updateMap(scope, child.id, { parentId: null });
      await repo.deletePartyMap(c.db, scope.pid, id);
    }
  });
}

// --- Pins ---

export function pinsOf(scope: MapScope, mapId: string): MapPin[] {
  const s = useMapStore.getState();
  return scope.kind === 'personal' ? (s.personal?.find((m) => m.id === mapId)?.pins ?? []) : s.partyPins;
}

/** Creates or updates a pin. New pins get the author; edits keep it. */
export function savePin(scope: MapScope, mapId: string, pin: MapPin) {
  return attempt(async () => {
    const now = Date.now();
    const s = useSession.getState();
    const isNew = !pinsOf(scope, mapId).some((p) => p.id === pin.id);
    if (isNew && pinsOf(scope, mapId).length >= PIN_LIMIT) throw new ImageError(`Una mappa può avere al massimo ${PIN_LIMIT} segnalini.`);
    const full: MapPin = isNew
      ? { ...pin, authorUid: s.user?.uid ?? '', authorName: s.user?.username ?? '', createdAt: now, updatedAt: now }
      : { ...pin, updatedAt: now };
    if (scope.kind === 'personal') {
      let changed: PersonalMap | null = null;
      setPersonal((maps) =>
        maps.map((m) => {
          if (m.id !== mapId) return m;
          const pins = isNew ? [...m.pins, full] : m.pins.map((p) => (p.id === pin.id ? full : p));
          changed = { ...m, pins, updatedAt: now };
          return changed;
        }),
      );
      await persistPersonal(changed);
    } else {
      const c = cloud();
      if (!c) throw new Error(OFFLINE);
      await repo.savePin(c.db, scope.pid, mapId, full);
    }
  });
}

export function removePin(scope: MapScope, mapId: string, pinId: string) {
  return attempt(async () => {
    if (scope.kind === 'personal') {
      let changed: PersonalMap | null = null;
      setPersonal((maps) =>
        maps.map((m) => {
          if (m.id !== mapId) return m;
          changed = { ...m, pins: m.pins.filter((p) => p.id !== pinId), updatedAt: Date.now() };
          return changed;
        }),
      );
      await persistPersonal(changed);
    } else {
      const c = cloud();
      if (!c) throw new Error(OFFLINE);
      await repo.deletePin(c.db, scope.pid, mapId, pinId);
    }
  });
}
