import type { Unsubscribe } from 'firebase/firestore';
import { create } from 'zustand';
import type { Character } from '../domain/character';
import {
  buildSummary,
  defaultSharing,
  LOG_PAGE,
  MEMBER_LIMIT,
  normalizeJoinCode,
  PARTY_LIMIT,
  sameSummary,
  type LogEntry,
  type Member,
  type MemberSummary,
  type Membership,
  type Party,
  type Quest,
  type Sharing,
} from '../domain/party';
import { useCharacterStore } from './characterStore';
import { getFirebase } from './firebase';
import { ensurePortraits, usePortraitStore } from './portraitStore';
import { buildMasterView, masterViewKey } from '../domain/masterView';
import * as repo from './partyRepo';
import { useSession } from './session';

/**
 * Parties for the signed-in user. Memberships are read once at login; the
 * group screen listens to one party only while it is open. Summaries are
 * published from here, debounced, and only when a shared field changed.
 */

export type PartyStatus = 'idle' | 'loading' | 'ready' | 'gone';

interface PartyState {
  /** null until loaded (or when logged out). */
  memberships: Membership[] | null;
  openId: string | null;
  status: PartyStatus;
  party: Party | null;
  members: Member[];
  quests: Quest[];
  log: LogEntry[];
  olderLog: LogEntry[];
  olderDone: boolean;
  closedQuests: Quest[] | null;
}

const initial: PartyState = {
  memberships: null,
  openId: null,
  status: 'idle',
  party: null,
  members: [],
  quests: [],
  log: [],
  olderLog: [],
  olderDone: false,
  closedQuests: null,
};

export const usePartyStore = create<PartyState>(() => initial);

const SUMMARY_DEBOUNCE_MS = 3000;
const OFFLINE = 'Operazione non riuscita: controlla la connessione e riprova.';

function ctx() {
  const fb = getFirebase();
  const user = useSession.getState().user;
  return fb && user && useSession.getState().phase === 'cloud' ? { db: fb.db, user } : null;
}

function allCharacters(): Character[] {
  const s = useCharacterStore.getState();
  return [s.character, ...s.others];
}

function findCharacter(id: string): Character | undefined {
  return allCharacters().find((c) => c.id === id);
}

function cardFor(c: Character, sharing: Sharing): repo.CardInput {
  return { characterId: c.id, summary: buildSummary(c, sharing), sharing };
}

function setMemberships(fn: (m: Membership[]) => Membership[]) {
  usePartyStore.setState((s) => ({ memberships: fn(s.memberships ?? []) }));
}

/** Wraps an action: returns an Italian error message, or null. */
async function attempt(fn: () => Promise<void>, failure = OFFLINE): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof PartyError ? e.message : failure;
  }
}

class PartyError extends Error {}

// --- Memberships ---

async function loadMemberships() {
  const c = ctx();
  if (!c) return;
  try {
    const memberships = await repo.fetchMemberships(c.db, c.user.uid);
    if (useSession.getState().user?.uid === c.user.uid) usePartyStore.setState({ memberships });
  } catch {
    usePartyStore.setState({ memberships: [] });
  }
}

useSession.subscribe((s, prev) => {
  if (s.phase === prev.phase && s.user?.uid === prev.user?.uid) return;
  if (s.phase === 'cloud' && s.user) {
    void loadMemberships();
  } else if (s.phase !== 'cloud') {
    closeParty();
    lastSent.clear();
    lastMaster.clear();
    timers.forEach(clearTimeout);
    timers.clear();
    usePartyStore.setState(initial);
  }
});

// --- Creating, joining, leaving ---

export function createParty(name: string, campaignName: string, characterId: string): Promise<string | null> {
  return attempt(async () => {
    const c = ctx();
    const character = findCharacter(characterId);
    if (!c || !character) throw new PartyError('Scegli il personaggio con cui partecipare.');
    if ((usePartyStore.getState().memberships ?? []).length >= PARTY_LIMIT) {
      throw new PartyError(`Puoi far parte al massimo di ${PARTY_LIMIT} gruppi: esci da uno per crearne un altro.`);
    }
    const m = await repo.createParty(c.db, c.user, { name: name.trim(), campaignName: campaignName.trim() }, cardFor(character, defaultSharing()));
    setMemberships((list) => [...list, m]);
    usePartyStore.setState({ openId: m.partyId });
  });
}

export function joinParty(codeInput: string, characterId: string): Promise<string | null> {
  return attempt(async () => {
    const c = ctx();
    const character = findCharacter(characterId);
    if (!c || !character) throw new PartyError('Scegli il personaggio con cui partecipare.');
    const code = normalizeJoinCode(codeInput);
    if (!code) throw new PartyError('Il codice ha 8 caratteri, lettere e cifre (per esempio K7QM-X2PD). Controlla e riprova.');
    const memberships = usePartyStore.getState().memberships ?? [];
    if (memberships.length >= PARTY_LIMIT) {
      throw new PartyError(`Puoi far parte al massimo di ${PARTY_LIMIT} gruppi: esci da uno per unirti a un altro.`);
    }
    const pid = await repo.lookupCode(c.db, code);
    if (!pid) throw new PartyError('Nessun gruppo con questo codice. Chiedi al DM il codice aggiornato.');
    if (memberships.some((m) => m.partyId === pid)) {
      usePartyStore.setState({ openId: pid });
      return;
    }
    let m: Membership;
    try {
      m = await repo.joinParty(c.db, c.user, pid, code, cardFor(character, defaultSharing()));
    } catch {
      throw new PartyError('Non riesco a unirmi: forse il DM ha chiuso le iscrizioni o cambiato il codice. Chiedine uno nuovo.');
    }
    // The member limit can only be checked once inside (non-members cannot read the members).
    if ((await repo.countMembers(c.db, pid)) > MEMBER_LIMIT) {
      await repo.leaveParty(c.db, c.user.uid, pid);
      throw new PartyError(`Il gruppo è al completo (${MEMBER_LIMIT} membri).`);
    }
    setMemberships((list) => [...list, m]);
    usePartyStore.setState({ openId: pid });
  });
}

export function leaveParty(pid: string): Promise<string | null> {
  return attempt(async () => {
    const c = ctx();
    if (!c) return;
    await repo.leaveParty(c.db, c.user.uid, pid);
    forgetLocally(pid);
  });
}

function forgetLocally(pid: string) {
  if (usePartyStore.getState().openId === pid) closeParty();
  lastSent.delete(pid);
  lastMaster.delete(pid);
  setMemberships((list) => list.filter((m) => m.partyId !== pid));
}

/** After "Non fai più parte di questo gruppo": drops the stale membership. */
export function forgetParty(pid: string): Promise<string | null> {
  return attempt(async () => {
    const c = ctx();
    if (!c) return;
    await repo.forgetMembership(c.db, c.user.uid, pid);
    forgetLocally(pid);
  });
}

// --- The open party (realtime) ---

let unsubscribe: Unsubscribe | null = null;

export function openParty(pid: string) {
  const c = ctx();
  if (!c) return;
  if (usePartyStore.getState().openId === pid && unsubscribe) return;
  closeParty();
  usePartyStore.setState({ ...initial, memberships: usePartyStore.getState().memberships, openId: pid, status: 'loading' });
  unsubscribe = repo.watchParty(c.db, pid, {
    onParty: (party) => {
      if (!party) {
        usePartyStore.setState({ status: 'gone', party: null });
        return;
      }
      usePartyStore.setState({ party, status: 'ready' });
      // Lazy rename: the cached name in "my parties" catches up here.
      const m = usePartyStore.getState().memberships?.find((x) => x.partyId === pid);
      const role = party.ownerUid === c.user.uid ? 'dm' : 'player';
      if (m && (m.name !== party.name || m.role !== role)) {
        setMemberships((list) => list.map((x) => (x.partyId === pid ? { ...x, name: party.name, role } : x)));
        void repo.updateMembership(c.db, c.user.uid, pid, { name: party.name, role }).catch(() => {});
      }
    },
    onMembers: (members) => {
      usePartyStore.setState({ members: members.sort((a, b) => a.joinedAt - b.joinedAt) });
      const mine = members.find((m) => m.uid === c.user.uid);
      if (mine) catchUpSummary(pid, mine.summary);
    },
    onQuests: (quests) => usePartyStore.setState({ quests }),
    onLog: (log) => usePartyStore.setState({ log }),
    onError: (code) => {
      if (code === 'permission-denied') usePartyStore.setState({ status: 'gone' });
    },
  });
}

export function closeParty() {
  unsubscribe?.();
  unsubscribe = null;
  usePartyStore.setState({ openId: null, status: 'idle', party: null, members: [], quests: [], log: [], olderLog: [], olderDone: false, closedQuests: null });
}

function open(): { db: NonNullable<ReturnType<typeof ctx>>['db']; user: NonNullable<ReturnType<typeof ctx>>['user']; party: Party } {
  const c = ctx();
  const party = usePartyStore.getState().party;
  if (!c || !party) throw new PartyError(OFFLINE);
  return { ...c, party };
}

// --- DM tools ---

export const updatePartyInfo = (patch: repo.PartyPatch) =>
  attempt(async () => {
    const { db, party } = open();
    await repo.updateParty(db, party.id, patch);
  });

export const regenerateCode = () =>
  attempt(async () => {
    const { db, party } = open();
    await repo.regenerateCode(db, party);
  });

export const removeMember = (uid: string) =>
  attempt(async () => {
    const { db, party } = open();
    await repo.removeMember(db, party.id, uid);
  });

export const transferOwnership = (toUid: string) =>
  attempt(async () => {
    const { db, user, party } = open();
    await repo.transferOwnership(db, party.id, user.uid, toUid);
    setMemberships((list) => list.map((x) => (x.partyId === party.id ? { ...x, role: 'player' } : x)));
  });

export const deleteParty = () =>
  attempt(async () => {
    const { db, user, party } = open();
    closeParty();
    await repo.deleteParty(db, user.uid, party);
    forgetLocally(party.id);
  }, 'Eliminazione non completata: controlla la connessione e riprova (quello che è già stato cancellato resta cancellato).');

export const saveQuest = (q: Omit<Quest, 'id' | 'updatedAt'> & { id?: string }) =>
  attempt(async () => {
    const { db, party } = open();
    await repo.saveQuest(db, party.id, q);
    if (q.status !== 'active') usePartyStore.setState({ closedQuests: null });
  });

export const deleteQuest = (id: string) =>
  attempt(async () => {
    const { db, party } = open();
    await repo.deleteQuest(db, party.id, id);
    usePartyStore.setState((s) => ({ closedQuests: s.closedQuests?.filter((q) => q.id !== id) ?? null }));
  });

export const loadClosedQuests = () =>
  attempt(async () => {
    const { db, party } = open();
    usePartyStore.setState({ closedQuests: await repo.fetchClosedQuests(db, party.id) });
  });

// --- Session log ---

export const saveLogEntry = (e: Pick<LogEntry, 'title' | 'body' | 'sessionDate'> & Partial<LogEntry>) =>
  attempt(async () => {
    const { db, user, party } = open();
    await repo.saveLogEntry(db, party.id, user, e);
    if (e.id) {
      usePartyStore.setState((s) => ({ olderLog: s.olderLog.map((x) => (x.id === e.id ? { ...x, ...e, updatedAt: Date.now() } : x)) }));
    }
  });

export const deleteLogEntry = (id: string) =>
  attempt(async () => {
    const { db, party } = open();
    await repo.deleteLogEntry(db, party.id, id);
    usePartyStore.setState((s) => ({ olderLog: s.olderLog.filter((x) => x.id !== id) }));
  });

export const loadOlderLog = () =>
  attempt(async () => {
    const { db, party } = open();
    const s = usePartyStore.getState();
    const oldest = [...s.log, ...s.olderLog].at(-1);
    if (!oldest) return;
    const page = await repo.fetchOlderLog(db, party.id, oldest.createdAt);
    usePartyStore.setState((x) => ({ olderLog: [...x.olderLog, ...page], olderDone: page.length < LOG_PAGE }));
  });

// --- My card: character, sharing, summary ---

export const setMyCharacter = (pid: string, characterId: string) =>
  attempt(async () => {
    const c = ctx();
    const m = usePartyStore.getState().memberships?.find((x) => x.partyId === pid);
    const character = findCharacter(characterId);
    if (!c || !m || !character) throw new PartyError(OFFLINE);
    const summary = buildSummary(character, m.sharing, await syncSharedPortrait(c, pid, characterId, m.sharing));
    await repo.updateMyCard(c.db, c.user.uid, pid, { characterId, summary });
    lastSent.set(pid, summary);
    setMemberships((list) => list.map((x) => (x.partyId === pid ? { ...x, characterId } : x)));
  });

export const setMySharing = (pid: string, sharing: Sharing) =>
  attempt(async () => {
    const c = ctx();
    const m = usePartyStore.getState().memberships?.find((x) => x.partyId === pid);
    const character = m && findCharacter(m.characterId);
    if (!c || !m) throw new PartyError(OFFLINE);
    const patch: Partial<repo.CardInput> = { sharing };
    if (character) patch.summary = buildSummary(character, sharing, await syncSharedPortrait(c, pid, character.id, sharing));
    if (character) await syncMasterView(c, pid, character, sharing);
    if (m.sharing.fullSheet && !sharing.fullSheet) {
      await repo.deleteMasterView(c.db, pid, c.user.uid).catch(() => {});
      lastMaster.delete(pid);
    }
    setMemberships((list) => list.map((x) => (x.partyId === pid ? { ...x, sharing } : x)));
    await repo.updateMyCard(c.db, c.user.uid, pid, patch);
    if (patch.summary) lastSent.set(pid, patch.summary);
  });

/**
 * Makes the shared portrait on the server match what I want to share, and returns its version for
 * the summary (undefined when none is shared). The portrait document goes first, so a member who
 * sees the new version in the summary always finds the picture.
 */
async function syncSharedPortrait(
  c: NonNullable<ReturnType<typeof ctx>>,
  pid: string,
  characterId: string,
  sharing: Sharing,
): Promise<number | undefined> {
  await ensurePortraits(characterId);
  const mine = usePortraitStore.getState().byId[characterId];
  const onServer = lastSent.get(pid)?.portraitAt;
  if (sharing.portrait && mine?.portrait) {
    if (onServer !== mine.updatedAt) await repo.saveSharedPortrait(c.db, pid, c.user.uid, mine.portrait, mine.updatedAt);
    return mine.updatedAt;
  }
  if (onServer !== undefined) await repo.deleteSharedPortrait(c.db, pid, c.user.uid);
  return undefined;
}

/** The shared full sheet last written, per party (a text, to skip a write when nothing changed). */
const lastMaster = new Map<string, string>();

/** Keeps the sheet shown to the Master up to date, when the player has chosen to share it. */
async function syncMasterView(c: NonNullable<ReturnType<typeof ctx>>, pid: string, character: Character, sharing: Sharing): Promise<void> {
  if (!sharing.fullSheet) return;
  const view = buildMasterView(character);
  const key = masterViewKey(view);
  if (lastMaster.get(pid) === key) return;
  await repo.saveMasterView(c.db, pid, c.user.uid, view);
  lastMaster.set(pid, key);
}

/** Last summary known to be on the server, per party. */
const lastSent = new Map<string, MemberSummary>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function publish(pid: string) {
  timers.delete(pid);
  const c = ctx();
  const m0 = usePartyStore.getState().memberships?.find((x) => x.partyId === pid);
  const character0 = m0 && findCharacter(m0.characterId);
  if (!c || !m0 || !character0) return;
  try {
    const portraitAt = await syncSharedPortrait(c, pid, character0.id, m0.sharing);
    // Read again: the character may have changed while the portrait was loading or uploading.
    const m = usePartyStore.getState().memberships?.find((x) => x.partyId === pid);
    const character = m && findCharacter(m.characterId);
    if (!m || !character || character.id !== character0.id) return;
    await syncMasterView(c, pid, character, m.sharing);
    const summary = buildSummary(character, m.sharing, portraitAt);
    if (sameSummary(lastSent.get(pid), summary)) return;
    const before = lastSent.get(pid);
    lastSent.set(pid, summary);
    await repo.updateMyCard(c.db, c.user.uid, pid, { summary }).catch(() => {
      if (before) lastSent.set(pid, before);
      else lastSent.delete(pid);
    });
  } catch {
    // Offline: the next change or visit publishes again.
  }
}

/** When the group screen shows our card, publish if it is behind the character (e.g. edited elsewhere). */
function catchUpSummary(pid: string, onServer: MemberSummary) {
  if (!lastSent.has(pid)) lastSent.set(pid, onServer);
  if (!timers.has(pid)) void publish(pid);
}

/** A new or removed portrait reaches the party like any other change of the card. */
usePortraitStore.subscribe((s, prev) => {
  if (s.byId === prev.byId) return;
  for (const m of usePartyStore.getState().memberships ?? []) {
    if (s.byId[m.characterId] === prev.byId[m.characterId] || prev.byId[m.characterId] === undefined) continue;
    const t = timers.get(m.partyId);
    if (t) clearTimeout(t);
    timers.set(m.partyId, setTimeout(() => void publish(m.partyId), 1000));
  }
});

useCharacterStore.subscribe((s, prev) => {
  if (s.revision === prev.revision) return;
  for (const m of usePartyStore.getState().memberships ?? []) {
    if (m.characterId !== s.character.id) continue;
    const t = timers.get(m.partyId);
    if (t) clearTimeout(t);
    timers.set(m.partyId, setTimeout(() => void publish(m.partyId), SUMMARY_DEBOUNCE_MS));
  }
});

/** Called when the page is hidden, so the group sees the last change. */
export function flushSummaries() {
  for (const pid of [...timers.keys()]) {
    clearTimeout(timers.get(pid));
    void publish(pid);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSummaries();
  });
}
