import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { emulatorConfig, firebaseConfig } from './firebaseConfig';

export interface FirebaseServices {
  auth: Auth;
  db: Firestore;
  emulated: boolean;
}

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

let services: FirebaseServices | null | undefined;

/** Lazily initialised; null when no Firebase project is configured (local mode only). */
export function getFirebase(): FirebaseServices | null {
  if (services !== undefined) return services;
  const config = useEmulators ? emulatorConfig : firebaseConfig;
  if (!config) return (services = null);

  const app = initializeApp(config);
  const auth = getAuth(app);
  // Firestore's own offline cache, shared across tabs: no custom sync engine.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return (services = { auth, db, emulated: useEmulators });
}
