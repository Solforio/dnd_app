import type { FirebaseOptions } from 'firebase/app';

/**
 * Web app config of the real Firebase project (Spark plan). It is public by
 * design: security comes from firestore.rules. Never put service-account keys
 * or admin credentials in this repository.
 *
 * null until the project exists: the app then offers only the local mode.
 */
export const firebaseConfig: FirebaseOptions | null = null;

/** Used with `npm run dev:emu`. A "demo-" project id never reaches real servers. */
export const emulatorConfig: FirebaseOptions = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-dnd.firebaseapp.com',
  projectId: 'demo-dnd',
  appId: 'demo-app',
};
