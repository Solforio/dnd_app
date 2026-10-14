import { deleteDoc, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { hasAnyPortrait, PORTRAIT_SCHEMA_VERSION, sanitizePortraits, type Portraits } from '../domain/portrait';

/**
 * Character pictures, kept apart from the character document.
 * Logged out: IndexedDB of this browser. Logged in: users/{uid}/portraits/{characterId}
 * (the owner only; a shared copy of the portrait lives in the party, see partyRepo).
 */

const DB_NAME = 'dnd-companion-portraits';
const STORE = 'portraits';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'characterId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('IndexedDB non disponibile'));
    };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
  });
}

export async function loadLocalPortraits(characterId: string): Promise<Portraits | null> {
  try {
    const raw = await run('readonly', (s) => s.get(characterId));
    return raw ? sanitizePortraits(raw) : null;
  } catch {
    return null;
  }
}

/** Saves, or deletes the record when there is no picture left. */
export async function saveLocalPortraits(characterId: string, p: Portraits): Promise<void> {
  if (!hasAnyPortrait(p)) await run('readwrite', (s) => s.delete(characterId));
  else await run('readwrite', (s) => s.put({ ...p, characterId }));
}

export async function deleteLocalPortraits(characterId: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(characterId));
  } catch {
    // Nothing to clean up if the browser has no IndexedDB.
  }
}

const ref = (db: Firestore, uid: string, characterId: string) => doc(db, 'users', uid, 'portraits', characterId);

/** One read, when the character becomes active. */
export async function fetchCloudPortraits(db: Firestore, uid: string, characterId: string): Promise<Portraits | null> {
  const snap = await getDoc(ref(db, uid, characterId));
  return snap.exists() ? sanitizePortraits(snap.data()) : null;
}

/** One write; the document is removed when there is no picture left. */
export function saveCloudPortraits(db: Firestore, uid: string, characterId: string, p: Portraits): Promise<void> {
  if (!hasAnyPortrait(p)) return deleteDoc(ref(db, uid, characterId));
  return setDoc(ref(db, uid, characterId), { ...p, schemaVersion: PORTRAIT_SCHEMA_VERSION });
}

export function deleteCloudPortraits(db: Firestore, uid: string, characterId: string): Promise<void> {
  return deleteDoc(ref(db, uid, characterId));
}
