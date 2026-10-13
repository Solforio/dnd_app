import type { FirebaseOptions } from 'firebase/app';

/**
 * Web app config of the real Firebase project (Spark plan). It is public by
 * design: security comes from firestore.rules. Never put service-account keys
 * or admin credentials in this repository.
 *
 * Set to null to make the app local-only.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyDhZ7cFZuBhdqItrOw_3el1EiocseYsm1U',
  authDomain: 'dungeons-9446d.firebaseapp.com',
  projectId: 'dungeons-9446d',
  storageBucket: 'dungeons-9446d.firebasestorage.app',
  messagingSenderId: '705316427918',
  appId: '1:705316427918:web:ad0bc9fd2daea95ad611df',
};

/** Used with `npm run dev:emu`. A "demo-" project id never reaches real servers. */
export const emulatorConfig: FirebaseOptions = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-dnd.firebaseapp.com',
  projectId: 'demo-dnd',
  appId: 'demo-app',
};
