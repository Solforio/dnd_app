import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { emailToUsername, usernameToEmail, validatePassword, validateUsername } from '../domain/account';
import { createProfile } from './characterRepo';
import { getFirebase } from './firebase';

export interface SessionUser {
  uid: string;
  username: string;
}

const NOT_CONFIGURED = 'Gli account non sono ancora attivi: per ora l’app funziona solo su questo dispositivo.';

/** Never includes the password in messages or logs. */
export function translateAuthError(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Questo nome utente è già preso: scegline un altro.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Nome utente o password sbagliati.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'La password deve avere almeno 6 caratteri.';
    case 'auth/invalid-email':
      return 'Firebase non accetta questo nome utente. Prova solo con lettere e cifre.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi: aspetta qualche minuto e riprova.';
    case 'auth/network-request-failed':
      return 'Nessuna connessione: per accedere o registrarti serve internet.';
    case 'auth/operation-not-allowed':
      return 'L’accesso con nome utente e password non è attivo nel progetto Firebase.';
    default:
      return 'Qualcosa è andato storto. Riprova tra poco.';
  }
}

export function accountsAvailable(): boolean {
  return getFirebase() !== null;
}

/** Returns an Italian error message, or null on success. */
export async function signUp(usernameInput: string, password: string): Promise<string | null> {
  const fb = getFirebase();
  if (!fb) return NOT_CONFIGURED;
  const u = validateUsername(usernameInput);
  if (!u.ok) return u.error;
  const p = validatePassword(password);
  if (!p.ok) return p.error;
  try {
    const cred = await createUserWithEmailAndPassword(fb.auth, usernameToEmail(u.value), password);
    // If this write fails, the session creates the profile on the next load.
    await createProfile(fb.db, cred.user.uid, u.value).catch(() => {});
    return null;
  } catch (e) {
    return translateAuthError(e);
  }
}

export async function signIn(usernameInput: string, password: string): Promise<string | null> {
  const fb = getFirebase();
  if (!fb) return NOT_CONFIGURED;
  const u = validateUsername(usernameInput);
  if (!u.ok) return u.error;
  if (password === '') return 'Scrivi la password.';
  try {
    await signInWithEmailAndPassword(fb.auth, usernameToEmail(u.value), password);
    return null;
  } catch (e) {
    return translateAuthError(e);
  }
}

export async function signOutUser(): Promise<void> {
  const fb = getFirebase();
  if (fb) await signOut(fb.auth);
}

export function watchAuth(cb: (user: SessionUser | null) => void): () => void {
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(fb.auth, (u) => cb(u ? { uid: u.uid, username: emailToUsername(u.email) } : null));
}
