import { waitForPendingWrites } from 'firebase/firestore';
import { create } from 'zustand';
import type { Character } from '../domain/character';
import { createDebouncedWriter, isUntouchedDefault, planUpload, type UploadPlan } from '../domain/sync';
import { signOutUser, watchAuth, type SessionUser } from './auth';
import { useCharacterStore } from './characterStore';
import {
  createProfile,
  deleteCharacter,
  fetchAll,
  fetchCharacter,
  saveCharacter,
  setActiveCharacter,
} from './characterRepo';
import { getFirebase } from './firebase';
import { loadLocal, saveLocal } from './localStore';

/**
 * Decides where characters live. Logged out: this browser (localStorage).
 * Logged in: the account (Firestore, with its offline cache). The two
 * workspaces stay separate; moving data between them always asks first.
 */

export type Phase = 'starting' | 'local' | 'loading' | 'cloud';

interface SessionState {
  phase: Phase;
  user: SessionUser | null;
  online: boolean;
  /** A change is waiting for the debounce. */
  debouncing: boolean;
  /** Writes sent to Firestore and not yet acknowledged by the server. */
  inFlight: number;
  writeError: string | null;
  warning: string | null;
  uploadOffer: UploadPlan | null;
}

export const useSession = create<SessionState>(() => ({
  phase: 'starting',
  user: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  debouncing: false,
  inFlight: 0,
  writeError: null,
  warning: null,
  uploadOffer: null,
}));

const CLOUD_DEBOUNCE_MS = 1500;
const LOCAL_DEBOUNCE_MS = 400;
const dismissKey = (uid: string) => `dnd-companion:upload-dismissed:${uid}`;

// --- Local workspace ---

let localUnreadable: unknown[] = [];
let localTimer: ReturnType<typeof setTimeout> | undefined;

function enterLocal() {
  const local = loadLocal();
  localUnreadable = local.unreadable;
  useCharacterStore.getState().showWorkspace(local.characters, local.activeCharacterId);
  useSession.setState({ phase: 'local', user: null, uploadOffer: null, writeError: null, warning: local.warning ?? null });
}

function flushLocal() {
  if (localTimer !== undefined) clearTimeout(localTimer);
  localTimer = undefined;
  if (useSession.getState().phase !== 'local') return;
  const { character, others } = useCharacterStore.getState();
  const ok = saveLocal({ characters: [character, ...others], activeCharacterId: character.id, unreadable: localUnreadable });
  if (!ok) {
    useSession.setState({
      warning: 'Il browser non permette di salvare: i dati andranno persi alla chiusura. Esporta un backup.',
    });
  }
}

// --- Cloud workspace ---

let lastSavedId: string | null = null;
/** Revision right after loading: if unchanged, the shown character is an unsaved blank or untouched. */
let loadedRevision = -1;
let cloudWasEmpty = false;

function writeNow(c: Character) {
  const fb = getFirebase();
  const user = useSession.getState().user;
  useSession.setState({ debouncing: false });
  if (!fb || !user) return;
  useSession.setState((s) => ({ inFlight: s.inFlight + 1 }));
  saveCharacter(fb.db, user.uid, c)
    .then(() => useSession.setState((s) => ({ inFlight: s.inFlight - 1, writeError: null })))
    .catch(() =>
      useSession.setState((s) => ({
        inFlight: s.inFlight - 1,
        writeError: 'Il salvataggio sull’account non è riuscito. Le modifiche restano su questo dispositivo: riprova più tardi.',
      })),
    );
}

const cloudWriter = createDebouncedWriter<Character>(writeNow, CLOUD_DEBOUNCE_MS);

async function enterCloud(user: SessionUser) {
  flushLocal();
  const fb = getFirebase();
  if (!fb) return;
  useSession.setState({ phase: 'loading', user, warning: null, writeError: null, uploadOffer: null });

  try {
    const snap = await fetchAll(fb.db, user.uid);
    if (useSession.getState().user?.uid !== user.uid) return; // signed out meanwhile
    if (!snap.profileExists) await createProfile(fb.db, user.uid, user.username).catch(() => {});

    const store = useCharacterStore.getState();
    store.showWorkspace(snap.characters, snap.activeCharacterId);
    const shown = useCharacterStore.getState();
    lastSavedId = snap.characters.some((c) => c.id === shown.character.id) ? shown.character.id : null;
    loadedRevision = shown.revision;
    cloudWasEmpty = snap.characters.length === 0;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(dismissKey(user.uid)) === '1';
    } catch {
      /* storage blocked: ask again */
    }
    const candidates = loadLocal().characters.filter((c) => !isUntouchedDefault(c));
    const plan = planUpload(candidates, snap.characters);
    const worthAsking = plan.fresh.length + plan.conflicts.length > 0;

    useSession.setState({
      phase: 'cloud',
      uploadOffer: worthAsking && !dismissed ? plan : null,
      warning:
        snap.unreadable > 0
          ? `${snap.unreadable} personaggi dell’account vengono da una versione più recente dell’app: aggiorna la pagina per vederli.`
          : null,
    });
  } catch {
    useSession.setState({
      phase: 'cloud',
      warning: 'Non riesco a leggere i dati dell’account. Controlla la connessione e ricarica la pagina.',
    });
  }
}

function leaveCloud() {
  cloudWriter.cancel();
  lastSavedId = null;
  enterLocal();
}

// --- Saving on every user change ---

function deleteNow(id: string) {
  const fb = getFirebase();
  const user = useSession.getState().user;
  if (!fb || !user) return;
  useSession.setState((s) => ({ inFlight: s.inFlight + 1 }));
  deleteCharacter(fb.db, user.uid, id)
    .then(() => useSession.setState((s) => ({ inFlight: s.inFlight - 1 })))
    .catch(() =>
      useSession.setState((s) => ({
        inFlight: s.inFlight - 1,
        writeError: 'Non sono riuscito a eliminare il personaggio dall’account: ricarica la pagina e riprova.',
      })),
    );
}

useCharacterStore.subscribe((s, prev) => {
  const edited = s.revision !== prev.revision;
  const switched = s.selection !== prev.selection;
  const removed = s.removed !== prev.removed && s.removed.length > 0;
  if (!edited && !switched && !removed) return;

  const phase = useSession.getState().phase;
  if (removed) useCharacterStore.setState({ removed: [] });
  if (phase === 'local') {
    // The whole workspace is written, so removed characters simply disappear.
    if (localTimer !== undefined) clearTimeout(localTimer);
    localTimer = setTimeout(flushLocal, LOCAL_DEBOUNCE_MS);
    return;
  }
  if (phase !== 'cloud') return;

  if (s.character.id !== lastSavedId) {
    cloudWriter.flush(); // the previous character's pending change goes first
    lastSavedId = s.character.id;
    const fb = getFirebase();
    const user = useSession.getState().user;
    if (fb && user) void setActiveCharacter(fb.db, user.uid, s.character.id).catch(() => {});
  }
  // After the flush above, so a pending write cannot bring a removed character back.
  if (removed) s.removed.forEach(deleteNow);
  if (edited) {
    cloudWriter.schedule(s.character);
    useSession.setState({ debouncing: true });
  }
});

// --- Upload of the device's characters to the account ---

export type ConflictChoice = 'local' | 'cloud';

/** Uploads new local characters and, for conflicts, the side the user chose. */
export function acceptUpload(choices: Record<string, ConflictChoice>) {
  const offer = useSession.getState().uploadOffer;
  if (!offer) return;
  const toUpload = [
    ...offer.fresh,
    ...offer.conflicts.filter((c) => choices[c.local.id] === 'local').map((c) => c.local),
  ].map((c) => ({ ...c, updatedAt: Date.now() }));

  cloudWriter.flush();
  for (const c of toUpload) writeNow(c);

  const store = useCharacterStore.getState();
  const current = [store.character, ...store.others];
  const replaced = new Map(toUpload.map((c) => [c.id, c]));
  const blankStillUnsaved = cloudWasEmpty && store.revision === loadedRevision;
  const merged = [
    ...current.filter((c) => !replaced.has(c.id) && !(blankStillUnsaved && c.id === store.character.id)),
    ...toUpload,
  ];
  const activeId = blankStillUnsaved || replaced.has(store.character.id) ? (toUpload[0]?.id ?? null) : store.character.id;
  store.showWorkspace(merged, activeId);
  lastSavedId = useCharacterStore.getState().character.id;
  const fb = getFirebase();
  const user = useSession.getState().user;
  if (fb && user && lastSavedId) void setActiveCharacter(fb.db, user.uid, lastSavedId).catch(() => {});
  useSession.setState({ uploadOffer: null });
}

export function dismissUpload(forever: boolean) {
  const user = useSession.getState().user;
  if (forever && user) {
    try {
      localStorage.setItem(dismissKey(user.uid), '1');
    } catch {
      /* ignore */
    }
  }
  useSession.setState({ uploadOffer: null });
}

// --- Sign-out ---

/**
 * Returns 'unsynced' (and does not sign out) when there are changes the server
 * has not received and the device is offline, unless `force` is set.
 */
export async function requestSignOut(force = false): Promise<'done' | 'unsynced'> {
  cloudWriter.flush();
  const s = useSession.getState();
  if (!force && s.inFlight > 0 && !s.online) return 'unsynced';
  const fb = getFirebase();
  if (fb && s.inFlight > 0) {
    await Promise.race([waitForPendingWrites(fb.db), new Promise((r) => setTimeout(r, 5000))]);
  }
  await signOutUser();
  return 'done';
}

// --- Freshness: pick up changes made on another device when this tab comes back ---

async function refreshActive() {
  const s = useSession.getState();
  const fb = getFirebase();
  if (s.phase !== 'cloud' || !s.user || !fb || cloudWriter.pending || s.inFlight > 0) return;
  const { character, revision } = useCharacterStore.getState();
  const remote = await fetchCharacter(fb.db, s.user.uid, character.id).catch(() => null);
  const now = useCharacterStore.getState();
  if (!remote || now.revision !== revision || remote.updatedAt <= now.character.updatedAt) return;
  now.showWorkspace([remote, ...now.others], remote.id);
}

// --- Start ---

let started = false;

export function startSession() {
  if (started) return;
  started = true;

  if (!getFirebase()) {
    enterLocal();
  } else {
    watchAuth((user) => {
      const current = useSession.getState();
      if (user && user.uid !== current.user?.uid) void enterCloud(user);
      else if (!user && current.phase !== 'local') leaveCloud();
    });
  }

  window.addEventListener('online', () => useSession.setState({ online: true }));
  window.addEventListener('offline', () => useSession.setState({ online: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushLocal();
      cloudWriter.flush();
    } else {
      void refreshActive();
    }
  });
  window.addEventListener('pagehide', () => {
    flushLocal();
    cloudWriter.flush();
  });
}
