import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { cryptoRandomBelow } from '../domain/dice/rng';
import { PORTRAIT_SCHEMA_VERSION, sanitizePortraits } from '../domain/portrait';
import {
  generateJoinCode,
  LOG_PAGE,
  PARTY_SCHEMA_VERSION,
  sanitizeLogEntry,
  sanitizeMember,
  sanitizeMembership,
  sanitizeParty,
  sanitizeQuest,
  sanitizeSummary,
  type LogEntry,
  type Member,
  type MemberSummary,
  type Membership,
  type Party,
  type Quest,
  type QuestStatus,
  type Role,
  type Sharing,
} from '../domain/party';
import type { SessionUser } from './auth';
import { deleteAllPartyMaps } from './mapRepo';

/**
 * Firestore access for parties (brief section 6):
 *   parties/{pid}, parties/{pid}/members|quests|log/{id}, partyCodes/{code},
 *   users/{uid}/memberships/{pid}
 * Everything read goes through the domain sanitizers: other users wrote it.
 */

const partyRef = (db: Firestore, pid: string) => doc(db, 'parties', pid);
const memberRef = (db: Firestore, pid: string, uid: string) => doc(db, 'parties', pid, 'members', uid);
const codeRef = (db: Firestore, code: string) => doc(db, 'partyCodes', code);
const membershipRef = (db: Firestore, uid: string, pid: string) => doc(db, 'users', uid, 'memberships', pid);
const questsOf = (db: Firestore, pid: string) => collection(db, 'parties', pid, 'quests');
const logOf = (db: Firestore, pid: string) => collection(db, 'parties', pid, 'log');

const newCode = () => generateJoinCode(cryptoRandomBelow);

/** One read per party the user belongs to. */
export async function fetchMemberships(db: Firestore, uid: string): Promise<Membership[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'memberships'));
  return snap.docs.map((d) => sanitizeMembership(d.id, d.data()));
}

export interface CardInput {
  characterId: string;
  summary: MemberSummary;
  sharing: Sharing;
}

function memberDoc(user: SessionUser, role: Role, code: string, card: CardInput, now: number) {
  return {
    schemaVersion: PARTY_SCHEMA_VERSION,
    username: user.username,
    role,
    characterId: card.characterId,
    summary: card.summary,
    sharing: card.sharing,
    joinCode: code,
    joinedAt: now,
    updatedAt: now,
  };
}

function membershipDoc(pid: string, name: string, role: Role, card: CardInput, now: number) {
  return {
    schemaVersion: PARTY_SCHEMA_VERSION,
    partyId: pid,
    name,
    role,
    characterId: card.characterId,
    sharing: card.sharing,
    joinedAt: now,
  };
}

/**
 * One batch of 4 writes. A code collision makes the batch fail (the code
 * document already exists), so it retries with a fresh code.
 */
export async function createParty(
  db: Firestore,
  user: SessionUser,
  info: { name: string; campaignName: string },
  card: CardInput,
): Promise<Membership> {
  const pid = doc(collection(db, 'parties')).id;
  for (let attempt = 0; ; attempt++) {
    const code = newCode();
    const now = Date.now();
    const b = writeBatch(db);
    b.set(partyRef(db, pid), {
      schemaVersion: PARTY_SCHEMA_VERSION,
      name: info.name,
      campaignName: info.campaignName,
      ownerUid: user.uid,
      joinCode: code,
      joinEnabled: true,
      currentLocation: '',
      nextSession: null,
      createdAt: now,
      updatedAt: now,
    });
    b.set(codeRef(db, code), { partyId: pid });
    b.set(memberRef(db, pid, user.uid), memberDoc(user, 'dm', code, card, now));
    const membership = membershipDoc(pid, info.name, 'dm', card, now);
    b.set(membershipRef(db, user.uid, pid), membership);
    try {
      await b.commit();
      return sanitizeMembership(pid, membership);
    } catch (e) {
      if (attempt >= 2) throw e;
    }
  }
}

/** One read. Returns the party id, or null for an unknown code. */
export async function lookupCode(db: Firestore, code: string): Promise<string | null> {
  const snap = await getDoc(codeRef(db, code));
  const pid = snap.data()?.partyId;
  return snap.exists() && typeof pid === 'string' ? pid : null;
}

/** One read (members count for the soft limit) after a batch of 2 writes. */
export async function joinParty(db: Firestore, user: SessionUser, pid: string, code: string, card: CardInput): Promise<Membership> {
  const now = Date.now();
  const membership = membershipDoc(pid, '', 'player', card, now);
  const b = writeBatch(db);
  b.set(memberRef(db, pid, user.uid), memberDoc(user, 'player', code, card, now));
  b.set(membershipRef(db, user.uid, pid), membership);
  await b.commit();
  return sanitizeMembership(pid, membership);
}

export async function countMembers(db: Firestore, pid: string): Promise<number> {
  return (await getDocs(collection(db, 'parties', pid, 'members'))).size;
}

// --- Shared portrait: parties/{pid}/members/{uid}/portrait/main ---

const portraitRef = (db: Firestore, pid: string, uid: string) => doc(db, 'parties', pid, 'members', uid, 'portrait', 'main');

/** One read per member and portrait version. */
export async function fetchSharedPortrait(db: Firestore, pid: string, uid: string): Promise<string | null> {
  const snap = await getDoc(portraitRef(db, pid, uid));
  return snap.exists() ? sanitizePortraits(snap.data()).portrait : null;
}

export function saveSharedPortrait(db: Firestore, pid: string, uid: string, portrait: string, updatedAt: number): Promise<void> {
  return setDoc(portraitRef(db, pid, uid), { schemaVersion: PORTRAIT_SCHEMA_VERSION, portrait, updatedAt });
}

export function deleteSharedPortrait(db: Firestore, pid: string, uid: string): Promise<void> {
  return deleteDoc(portraitRef(db, pid, uid));
}

/** Leaving: the shared portrait (best effort), then the member card and the private membership. */
export async function leaveParty(db: Firestore, uid: string, pid: string): Promise<void> {
  await deleteSharedPortrait(db, pid, uid).catch(() => {});
  const b = writeBatch(db);
  b.delete(memberRef(db, pid, uid));
  b.delete(membershipRef(db, uid, pid));
  await b.commit();
}

/** Only the membership: used when the party is gone or the user was removed. */
export function forgetMembership(db: Firestore, uid: string, pid: string): Promise<void> {
  return deleteDoc(membershipRef(db, uid, pid));
}

/**
 * Firestore does not cascade: maps with their pins, quests and log entries go first (in batches of
 * up to 450), then the members, the code and the party, the DM's own card last.
 */
export async function deleteParty(db: Firestore, uid: string, party: Party): Promise<void> {
  const pid = party.id;
  await deleteAllPartyMaps(db, pid);
  const [quests, log, members] = await Promise.all([
    getDocs(questsOf(db, pid)),
    getDocs(logOf(db, pid)),
    getDocs(collection(db, 'parties', pid, 'members')),
  ]);
  const refs: DocumentReference[] = [...quests.docs, ...log.docs].map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const b = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => b.delete(r));
    await b.commit();
  }
  // Shared portraits live under the member cards and are not removed with them.
  const withPortrait = members.docs.filter((d) => sanitizeSummary(d.data().summary).portraitAt);
  for (const d of withPortrait) await deleteSharedPortrait(db, pid, d.id).catch(() => {});
  const b = writeBatch(db);
  members.docs.filter((d) => d.id !== uid).forEach((d) => b.delete(d.ref));
  b.delete(codeRef(db, party.joinCode));
  b.delete(partyRef(db, pid));
  b.delete(memberRef(db, pid, uid));
  b.delete(membershipRef(db, uid, pid));
  await b.commit();
}

export type PartyPatch = Partial<Pick<Party, 'name' | 'campaignName' | 'currentLocation' | 'nextSession' | 'joinEnabled'>>;

export async function updateParty(db: Firestore, pid: string, patch: PartyPatch): Promise<void> {
  const b = writeBatch(db);
  b.update(partyRef(db, pid), { ...patch, updatedAt: Date.now() });
  await b.commit();
}

/** Old code out, new code in, in one batch; retries on a collision. Returns the new code. */
export async function regenerateCode(db: Firestore, party: Party): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const code = newCode();
    const b = writeBatch(db);
    b.delete(codeRef(db, party.joinCode));
    b.set(codeRef(db, code), { partyId: party.id });
    b.update(partyRef(db, party.id), { joinCode: code, updatedAt: Date.now() });
    try {
      await b.commit();
      return code;
    } catch (e) {
      if (attempt >= 2) throw e;
    }
  }
}

/** The DM hands the party to another member; the new DM's private membership catches up when they open it. */
export async function transferOwnership(db: Firestore, pid: string, fromUid: string, toUid: string): Promise<void> {
  const b = writeBatch(db);
  b.update(partyRef(db, pid), { ownerUid: toUid, updatedAt: Date.now() });
  b.update(memberRef(db, pid, fromUid), { role: 'player' });
  b.update(memberRef(db, pid, toUid), { role: 'dm' });
  b.update(membershipRef(db, fromUid, pid), { role: 'player' });
  await b.commit();
}

export async function removeMember(db: Firestore, pid: string, uid: string): Promise<void> {
  await deleteSharedPortrait(db, pid, uid).catch(() => {});
  return deleteDoc(memberRef(db, pid, uid));
}

/** One write to the card; the private mirror only when character or sharing change. */
export async function updateMyCard(
  db: Firestore,
  uid: string,
  pid: string,
  patch: Partial<CardInput>,
): Promise<void> {
  const b = writeBatch(db);
  b.update(memberRef(db, pid, uid), { ...patch, updatedAt: Date.now() });
  const mirror: Record<string, unknown> = {};
  if (patch.characterId !== undefined) mirror.characterId = patch.characterId;
  if (patch.sharing !== undefined) mirror.sharing = patch.sharing;
  if (Object.keys(mirror).length > 0) b.update(membershipRef(db, uid, pid), mirror);
  await b.commit();
}

export function updateMembership(db: Firestore, uid: string, pid: string, patch: Partial<Pick<Membership, 'name' | 'role'>>) {
  const b = writeBatch(db);
  b.update(membershipRef(db, uid, pid), patch);
  return b.commit();
}

// --- Quests ---

export async function saveQuest(db: Firestore, pid: string, q: Omit<Quest, 'id' | 'updatedAt'> & { id?: string }): Promise<void> {
  const ref = q.id ? doc(questsOf(db, pid), q.id) : doc(questsOf(db, pid));
  const b = writeBatch(db);
  b.set(ref, { schemaVersion: PARTY_SCHEMA_VERSION, title: q.title, description: q.description, status: q.status, updatedAt: Date.now() });
  await b.commit();
}

export function deleteQuest(db: Firestore, pid: string, id: string) {
  return deleteDoc(doc(questsOf(db, pid), id));
}

/** Completed or failed quests are read on demand, not listened to. */
export async function fetchClosedQuests(db: Firestore, pid: string): Promise<Quest[]> {
  const snap = await getDocs(query(questsOf(db, pid), where('status', 'in', ['completed', 'failed'] satisfies QuestStatus[])));
  return snap.docs.map((d) => sanitizeQuest(d.id, d.data())).sort((a, b) => b.updatedAt - a.updatedAt);
}

// --- Session log ---

export async function saveLogEntry(
  db: Firestore,
  pid: string,
  user: SessionUser,
  e: Pick<LogEntry, 'title' | 'body' | 'sessionDate'> & { id?: string; authorUid?: string; authorName?: string; createdAt?: number },
): Promise<void> {
  const now = Date.now();
  const ref = e.id ? doc(logOf(db, pid), e.id) : doc(logOf(db, pid));
  const b = writeBatch(db);
  b.set(ref, {
    schemaVersion: PARTY_SCHEMA_VERSION,
    title: e.title,
    body: e.body,
    sessionDate: e.sessionDate,
    // An edit keeps the original author, even when the DM makes it.
    authorUid: e.authorUid ?? user.uid,
    authorName: e.authorName ?? user.username,
    createdAt: e.createdAt ?? now,
    updatedAt: now,
  });
  await b.commit();
}

export function deleteLogEntry(db: Firestore, pid: string, id: string) {
  return deleteDoc(doc(logOf(db, pid), id));
}

/** Older entries, a page at a time, after the oldest one on screen. */
export async function fetchOlderLog(db: Firestore, pid: string, beforeCreatedAt: number): Promise<LogEntry[]> {
  const snap = await getDocs(query(logOf(db, pid), orderBy('createdAt', 'desc'), startAfter(beforeCreatedAt), limit(LOG_PAGE)));
  return snap.docs.map((d) => sanitizeLogEntry(d.id, d.data()));
}

// --- Realtime, only while the group screen is open ---

export interface PartyListeners {
  onParty: (p: Party | null) => void;
  onMembers: (m: Member[]) => void;
  onQuests: (q: Quest[]) => void;
  onLog: (l: LogEntry[]) => void;
  /** permission-denied: the user is no longer a member (removed, or the party was deleted). */
  onError: (code: string) => void;
}

export function watchParty(db: Firestore, pid: string, l: PartyListeners): Unsubscribe {
  const err = (e: { code: string }) => l.onError(e.code);
  const subs = [
    onSnapshot(partyRef(db, pid), (s) => l.onParty(s.exists() ? sanitizeParty(s.id, s.data()) : null), err),
    onSnapshot(collection(db, 'parties', pid, 'members'), (s) => l.onMembers(s.docs.map((d) => sanitizeMember(d.id, d.data()))), err),
    onSnapshot(query(questsOf(db, pid), where('status', '==', 'active')), (s) =>
      l.onQuests(s.docs.map((d) => sanitizeQuest(d.id, d.data())).sort((a, b) => b.updatedAt - a.updatedAt)), err),
    onSnapshot(query(logOf(db, pid), orderBy('createdAt', 'desc'), limit(LOG_PAGE)), (s) =>
      l.onLog(s.docs.map((d) => sanitizeLogEntry(d.id, d.data()))), err),
  ];
  return () => subs.forEach((u) => u());
}
