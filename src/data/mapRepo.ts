import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { newId } from '../domain/character';
import {
  MAP_SCHEMA_VERSION,
  sanitizeMap,
  sanitizePersonalMap,
  sanitizePin,
  type GameMap,
  type MapPin,
  type PersonalMap,
} from '../domain/maps';

/**
 * Map documents. Personal maps: users/{uid}/maps/{id} (pins inside), or
 * localStorage when logged out. Party maps: parties/{pid}/maps/{id}, with one
 * document per pin in parties/{pid}/maps/{id}/pins/{pinId}.
 */

// --- Personal, logged out ---

const LOCAL_KEY = 'dnd-companion:maps';

export function loadLocalMaps(): PersonalMap[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null') as { maps?: unknown[] } | null;
    return (raw?.maps ?? []).map((m) => {
      const id = typeof (m as { id?: unknown }).id === 'string' ? (m as { id: string }).id : newId();
      return sanitizePersonalMap(id, m, newId);
    });
  } catch {
    return [];
  }
}

export function saveLocalMaps(maps: PersonalMap[]): boolean {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ schemaVersion: MAP_SCHEMA_VERSION, maps }));
    return true;
  } catch {
    return false;
  }
}

// --- Personal, account ---

const personalOf = (db: Firestore, uid: string) => collection(db, 'users', uid, 'maps');

/** One read per map, once per session. */
export async function fetchPersonalMaps(db: Firestore, uid: string): Promise<PersonalMap[]> {
  const snap = await getDocs(personalOf(db, uid));
  return snap.docs.map((d) => sanitizePersonalMap(d.id, d.data(), newId));
}

/** One write: the whole map with its pins. */
export function savePersonalMap(db: Firestore, uid: string, m: PersonalMap): Promise<void> {
  const { id, ...data } = m;
  return setDoc(doc(personalOf(db, uid), id), { ...data, schemaVersion: MAP_SCHEMA_VERSION });
}

export function deletePersonalMap(db: Firestore, uid: string, id: string): Promise<void> {
  return deleteDoc(doc(personalOf(db, uid), id));
}

// --- Party ---

const partyMapsOf = (db: Firestore, pid: string) => collection(db, 'parties', pid, 'maps');
const pinsOf = (db: Firestore, pid: string, mapId: string) => collection(db, 'parties', pid, 'maps', mapId, 'pins');

/** Listens to a party's maps (at most 30 documents) while the maps page shows that party. */
export function watchPartyMaps(db: Firestore, pid: string, onMaps: (m: GameMap[]) => void, onError: () => void): Unsubscribe {
  return onSnapshot(partyMapsOf(db, pid), (s) => onMaps(s.docs.map((d) => sanitizeMap(d.id, d.data()))), onError);
}

export function savePartyMap(db: Firestore, pid: string, m: GameMap, createdBy: string): Promise<void> {
  const { id, ...data } = m;
  return setDoc(doc(partyMapsOf(db, pid), id), { ...data, createdBy, schemaVersion: MAP_SCHEMA_VERSION });
}

/** Firestore does not cascade: the pins go first, in batches, then the map. */
export async function deletePartyMap(db: Firestore, pid: string, mapId: string): Promise<void> {
  const pins = await getDocs(pinsOf(db, pid, mapId));
  for (let i = 0; i < pins.docs.length; i += 450) {
    const b = writeBatch(db);
    pins.docs.slice(i, i + 450).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  await deleteDoc(doc(partyMapsOf(db, pid), mapId));
}

/** Listens to the pins of one party map while it is open. */
export function watchPins(db: Firestore, pid: string, mapId: string, onPins: (p: MapPin[]) => void, onError: () => void): Unsubscribe {
  return onSnapshot(pinsOf(db, pid, mapId), (s) => onPins(s.docs.map((d) => sanitizePin({ ...d.data(), id: d.id }, d.id))), onError);
}

export function savePin(db: Firestore, pid: string, mapId: string, pin: MapPin): Promise<void> {
  const { id, ...data } = pin;
  return setDoc(doc(pinsOf(db, pid, mapId), id), { ...data, schemaVersion: MAP_SCHEMA_VERSION });
}

export function deletePin(db: Firestore, pid: string, mapId: string, pinId: string): Promise<void> {
  return deleteDoc(doc(pinsOf(db, pid, mapId), pinId));
}

/** Used when a whole party is deleted: every map with its pins. */
export async function deleteAllPartyMaps(db: Firestore, pid: string): Promise<void> {
  const maps = await getDocs(partyMapsOf(db, pid));
  for (const m of maps.docs) await deletePartyMap(db, pid, m.id);
}
