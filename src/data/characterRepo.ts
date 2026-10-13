import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { USER_SCHEMA_VERSION, type UserDoc } from '../domain/account';
import { loadCharacter, type Character } from '../domain/character';

/**
 * Firestore access for private character data:
 *   users/{uid}                          profile, incl. activeCharacterId
 *   users/{uid}/characters/{characterId} one document per character
 * Every document read goes through loadCharacter (migrate, then sanitize).
 */

const charactersOf = (db: Firestore, uid: string) => collection(db, 'users', uid, 'characters');

export interface CloudSnapshot {
  characters: Character[];
  activeCharacterId: string | null;
  /** False if sign-up stopped between creating the account and writing users/{uid}. */
  profileExists: boolean;
  /** Documents this app version cannot read (e.g. written by a newer version). They are left untouched. */
  unreadable: number;
}

/** One read per character plus one for the profile. */
export async function fetchAll(db: Firestore, uid: string): Promise<CloudSnapshot> {
  const [profile, snap] = await Promise.all([getDoc(doc(db, 'users', uid)), getDocs(charactersOf(db, uid))]);
  const characters: Character[] = [];
  let unreadable = 0;
  for (const d of snap.docs) {
    try {
      characters.push(loadCharacter(d.data()));
    } catch {
      unreadable += 1;
    }
  }
  const active = profile.data()?.activeCharacterId;
  return {
    characters,
    activeCharacterId: typeof active === 'string' ? active : null,
    profileExists: profile.exists(),
    unreadable,
  };
}

export function createProfile(db: Firestore, uid: string, username: string): Promise<void> {
  const profile: UserDoc = {
    schemaVersion: USER_SCHEMA_VERSION,
    username,
    activeCharacterId: null,
    createdAt: Date.now(),
  };
  return setDoc(doc(db, 'users', uid), profile);
}

/** One read. Returns null if missing or unreadable. */
export async function fetchCharacter(db: Firestore, uid: string, id: string): Promise<Character | null> {
  const snap = await getDoc(doc(charactersOf(db, uid), id));
  if (!snap.exists()) return null;
  try {
    return loadCharacter(snap.data());
  } catch {
    return null;
  }
}

/**
 * One write. Resolves when the server acknowledges it; offline it stays
 * pending while the change already sits in the local cache.
 */
export function saveCharacter(db: Firestore, uid: string, c: Character): Promise<void> {
  return setDoc(doc(charactersOf(db, uid), c.id), c);
}

export function setActiveCharacter(db: Firestore, uid: string, id: string): Promise<void> {
  return updateDoc(doc(db, 'users', uid), { activeCharacterId: id });
}

/** One write (a delete). Deleting a document that was never saved is harmless. */
export function deleteCharacter(db: Firestore, uid: string, id: string): Promise<void> {
  return deleteDoc(doc(charactersOf(db, uid), id));
}
