import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dnd-parties',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// The test context returns the compat type; the modular functions accept it at runtime.
const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@dnd.local` }).firestore() as unknown as Firestore;
const T = 1_700_000_000_000;
const CODE = 'ABCDEFGH';
const sharing = { hp: 'status', fields: { conditions: true } };

const party = (owner: string, code = CODE) => ({
  schemaVersion: 1,
  name: 'La Miniera Perduta',
  campaignName: 'Phandelver',
  ownerUid: owner,
  joinCode: code,
  joinEnabled: true,
  currentLocation: '',
  nextSession: null,
  createdAt: T,
  updatedAt: T,
});

const member = (uid: string, role: 'dm' | 'player', code = CODE) => ({
  schemaVersion: 1,
  username: uid,
  role,
  characterId: 'c1',
  summary: { characterName: uid, class: 'Guerriero 1', level: 1 },
  sharing,
  joinCode: code,
  joinedAt: T,
  updatedAt: T,
});

const membership = (pid: string, role: 'dm' | 'player', name = 'La Miniera Perduta') => ({
  schemaVersion: 1,
  partyId: pid,
  name,
  role,
  characterId: 'c1',
  sharing,
  joinedAt: T,
});

function createParty(db: Firestore, uid: string, pid = 'p1', code = CODE) {
  const b = writeBatch(db);
  b.set(doc(db, `parties/${pid}`), party(uid, code));
  b.set(doc(db, `partyCodes/${code}`), { partyId: pid });
  b.set(doc(db, `parties/${pid}/members/${uid}`), member(uid, 'dm', code));
  b.set(doc(db, `users/${uid}/memberships/${pid}`), membership(pid, 'dm'));
  return b.commit();
}

function join(db: Firestore, uid: string, pid = 'p1', code = CODE) {
  const b = writeBatch(db);
  b.set(doc(db, `parties/${pid}/members/${uid}`), member(uid, 'player', code));
  b.set(doc(db, `users/${uid}/memberships/${pid}`), membership(pid, 'player', ''));
  return b.commit();
}

/** alice is DM of p1, bob is a player; eve is a stranger. */
async function seedParty() {
  await createParty(as('alice'), 'alice');
  await join(as('bob'), 'bob');
}

describe('creating a party', () => {
  it('works as one batch with code, DM member and membership', async () => {
    await assertSucceeds(createParty(as('alice'), 'alice'));
  });

  it('refuses a party owned by someone else', async () => {
    const db = as('alice');
    const b = writeBatch(db);
    b.set(doc(db, 'parties/p1'), party('bob'));
    b.set(doc(db, `partyCodes/${CODE}`), { partyId: 'p1' });
    b.set(doc(db, 'parties/p1/members/alice'), member('alice', 'dm'));
    await assertFails(b.commit());
  });

  it('refuses a party without its code or without the DM member', async () => {
    const db = as('alice');
    await assertFails(setDoc(doc(db, 'parties/p1'), party('alice')));
    const b = writeBatch(db);
    b.set(doc(db, 'parties/p1'), party('alice'));
    b.set(doc(db, `partyCodes/${CODE}`), { partyId: 'p1' });
    await assertFails(b.commit());
  });

  it('refuses a code that is already taken', async () => {
    await createParty(as('alice'), 'alice');
    await assertFails(createParty(as('carol'), 'carol', 'p2', CODE));
  });
});

describe('joining with a code', () => {
  it('lets a signed-in user read a code, but never list codes', async () => {
    await createParty(as('alice'), 'alice');
    await assertSucceeds(getDoc(doc(as('bob'), `partyCodes/${CODE}`)));
    await assertFails(getDocs(collection(as('bob'), 'partyCodes')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `partyCodes/${CODE}`)));
  });

  it('lets a player join with the right code', async () => {
    await createParty(as('alice'), 'alice');
    await assertSucceeds(join(as('bob'), 'bob'));
    await assertSucceeds(getDoc(doc(as('bob'), 'parties/p1')));
  });

  it('refuses a wrong code, a closed party, a DM role or another uid', async () => {
    await createParty(as('alice'), 'alice');
    await assertFails(join(as('bob'), 'bob', 'p1', 'ZZZZZZZZ'));
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/members/bob'), member('bob', 'dm')));
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/members/carol'), member('carol', 'player')));
    await updateDoc(doc(as('alice'), 'parties/p1'), { joinEnabled: false });
    await assertFails(join(as('bob'), 'bob'));
  });

  it('refuses a username that does not match the sign-in email', async () => {
    await createParty(as('alice'), 'alice');
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/members/bob'), { ...member('bob', 'player'), username: 'alice' }));
  });

  it('refuses a membership without the member document', async () => {
    await createParty(as('alice'), 'alice');
    await assertFails(setDoc(doc(as('bob'), 'users/bob/memberships/p1'), membership('p1', 'player')));
  });
});

describe('isolation', () => {
  it('hides everything inside a party from non-members', async () => {
    await seedParty();
    await setDoc(doc(as('alice'), 'parties/p1/quests/q1'), { schemaVersion: 1, title: 'Q', description: '', status: 'active', updatedAt: T });
    const eve = as('eve');
    await assertFails(getDoc(doc(eve, 'parties/p1')));
    await assertFails(getDocs(collection(eve, 'parties/p1/members')));
    await assertFails(getDocs(collection(eve, 'parties/p1/quests')));
    await assertFails(getDocs(collection(eve, 'parties/p1/log')));
    await assertFails(getDocs(collection(eve, 'parties')));
    await assertFails(setDoc(doc(eve, 'parties/p1/log/e1'), { schemaVersion: 1, title: 'x', body: '', sessionDate: '', authorUid: 'eve', authorName: 'eve', createdAt: T, updatedAt: T }));
    await assertFails(updateDoc(doc(eve, 'parties/p1'), { name: 'Mia' }));
    await assertFails(deleteDoc(doc(eve, 'parties/p1/members/bob')));
  });

  it('lets members read the party, the members and the quests', async () => {
    await seedParty();
    const bob = as('bob');
    await assertSucceeds(getDoc(doc(bob, 'parties/p1')));
    await assertSucceeds(getDocs(collection(bob, 'parties/p1/members')));
    await assertSucceeds(getDocs(collection(bob, 'parties/p1/quests')));
  });

  it('keeps memberships private', async () => {
    await seedParty();
    await assertFails(getDoc(doc(as('alice'), 'users/bob/memberships/p1')));
  });
});

describe('member cards', () => {
  it('lets a player update their own card, not the role, nor other cards', async () => {
    await seedParty();
    const bob = as('bob');
    await assertSucceeds(updateDoc(doc(bob, 'parties/p1/members/bob'), { summary: { characterName: 'Pip', class: '', level: 2 }, updatedAt: T + 1 }));
    await assertFails(updateDoc(doc(bob, 'parties/p1/members/bob'), { role: 'dm' }));
    await assertFails(updateDoc(doc(bob, 'parties/p1/members/bob'), { username: 'robert' }));
    await assertFails(updateDoc(doc(bob, 'parties/p1/members/alice'), { summary: {} }));
  });

  it('lets the DM remove a member, and a player leave', async () => {
    await seedParty();
    await join(as('carol'), 'carol');
    await assertSucceeds(deleteDoc(doc(as('alice'), 'parties/p1/members/bob')));
    await assertSucceeds(deleteDoc(doc(as('carol'), 'parties/p1/members/carol')));
  });

  it('does not let the DM leave a party that still exists', async () => {
    await seedParty();
    await assertFails(deleteDoc(doc(as('alice'), 'parties/p1/members/alice')));
  });
});

describe('party management', () => {
  it('lets only the DM edit the party', async () => {
    await seedParty();
    await assertSucceeds(updateDoc(doc(as('alice'), 'parties/p1'), { currentLocation: 'Phandalin', updatedAt: T + 1 }));
    await assertFails(updateDoc(doc(as('bob'), 'parties/p1'), { currentLocation: 'Neverwinter' }));
  });

  it('transfers ownership with both roles swapped in one batch', async () => {
    await seedParty();
    const db = as('alice');
    const b = writeBatch(db);
    b.update(doc(db, 'parties/p1'), { ownerUid: 'bob' });
    b.update(doc(db, 'parties/p1/members/alice'), { role: 'player' });
    b.update(doc(db, 'parties/p1/members/bob'), { role: 'dm' });
    await assertSucceeds(b.commit());
    await assertSucceeds(updateDoc(doc(as('bob'), 'parties/p1'), { name: 'Nuovo nome' }));
    await assertFails(updateDoc(doc(as('alice'), 'parties/p1'), { name: 'Rivoglio' }));
  });

  it('refuses a transfer without the role swap, or to a non-member', async () => {
    await seedParty();
    const db = as('alice');
    await assertFails(updateDoc(doc(db, 'parties/p1'), { ownerUid: 'bob' }));
    await assertFails(updateDoc(doc(db, 'parties/p1/members/bob'), { role: 'dm' }));
    await assertFails(updateDoc(doc(db, 'parties/p1'), { ownerUid: 'eve' }));
  });

  it('regenerates the code: old one removed, new one created, members stay', async () => {
    await seedParty();
    const db = as('alice');
    const b = writeBatch(db);
    b.delete(doc(db, `partyCodes/${CODE}`));
    b.set(doc(db, 'partyCodes/HJKMNPQR'), { partyId: 'p1' });
    b.update(doc(db, 'parties/p1'), { joinCode: 'HJKMNPQR' });
    await assertSucceeds(b.commit());
    await assertSucceeds(getDoc(doc(as('bob'), 'parties/p1')));
    await assertFails(join(as('carol'), 'carol', 'p1', CODE));
    await assertSucceeds(join(as('carol'), 'carol', 'p1', 'HJKMNPQR'));
  });

  it('refuses a code change that leaves the old code behind', async () => {
    await seedParty();
    const db = as('alice');
    const b = writeBatch(db);
    b.set(doc(db, 'partyCodes/HJKMNPQR'), { partyId: 'p1' });
    b.update(doc(db, 'parties/p1'), { joinCode: 'HJKMNPQR' });
    await assertFails(b.commit());
  });

  it('lets the DM delete everything, the DM card last', async () => {
    await seedParty();
    const db = as('alice');
    await setDoc(doc(db, 'parties/p1/quests/q1'), { schemaVersion: 1, title: 'Q', description: '', status: 'active', updatedAt: T });
    await setDoc(doc(as('bob'), 'parties/p1/log/e1'), { schemaVersion: 1, title: 'S1', body: '', sessionDate: '', authorUid: 'bob', authorName: 'bob', createdAt: T, updatedAt: T });
    const first = writeBatch(db);
    first.delete(doc(db, 'parties/p1/quests/q1'));
    first.delete(doc(db, 'parties/p1/log/e1'));
    await assertSucceeds(first.commit());
    const last = writeBatch(db);
    last.delete(doc(db, 'parties/p1/members/bob'));
    last.delete(doc(db, `partyCodes/${CODE}`));
    last.delete(doc(db, 'parties/p1'));
    last.delete(doc(db, 'parties/p1/members/alice'));
    last.delete(doc(db, 'users/alice/memberships/p1'));
    await assertSucceeds(last.commit());
  });

  it('does not let a player delete the party', async () => {
    await seedParty();
    await assertFails(deleteDoc(doc(as('bob'), 'parties/p1')));
  });
});

describe('quests and session log', () => {
  const quest = { schemaVersion: 1, title: 'Salva Gundren', description: '', status: 'active', updatedAt: T };
  const entry = (author: string) => ({
    schemaVersion: 1,
    title: 'Sessione 1',
    body: 'Goblin ovunque.',
    sessionDate: '2026-10-11',
    authorUid: author,
    authorName: author,
    createdAt: T,
    updatedAt: T,
  });

  it('lets only the DM write quests', async () => {
    await seedParty();
    await assertSucceeds(setDoc(doc(as('alice'), 'parties/p1/quests/q1'), quest));
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/quests/q2'), quest));
    await assertFails(updateDoc(doc(as('bob'), 'parties/p1/quests/q1'), { status: 'completed' }));
  });

  it('lets any member write their own log entries, and the author or DM edit them', async () => {
    await seedParty();
    await join(as('carol'), 'carol');
    await assertSucceeds(setDoc(doc(as('bob'), 'parties/p1/log/e1'), entry('bob')));
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/log/e2'), entry('carol')));
    await assertSucceeds(updateDoc(doc(as('bob'), 'parties/p1/log/e1'), { body: 'Corretto', updatedAt: T + 1 }));
    await assertSucceeds(updateDoc(doc(as('alice'), 'parties/p1/log/e1'), { title: 'Sessione 1: Phandalin' }));
    await assertFails(updateDoc(doc(as('carol'), 'parties/p1/log/e1'), { body: 'Mio' }));
    await assertFails(updateDoc(doc(as('bob'), 'parties/p1/log/e1'), { authorUid: 'carol' }));
    await assertFails(deleteDoc(doc(as('carol'), 'parties/p1/log/e1')));
    await assertSucceeds(deleteDoc(doc(as('alice'), 'parties/p1/log/e1')));
  });
});

describe('maps', () => {
  const FP = 'f'.repeat(32);
  const personalMap = { schemaVersion: 1, name: 'Faerûn', parentId: null, fingerprint: FP, width: 4000, height: 3000, pins: [], createdAt: T, updatedAt: T };
  const partyMap = { schemaVersion: 1, name: 'Faerûn', parentId: null, fingerprint: FP, width: 4000, height: 3000, createdBy: 'alice', createdAt: T, updatedAt: T };
  const pin = (author: string) => ({
    schemaVersion: 1,
    x: 0.25,
    y: 0.5,
    title: 'Phandalin',
    note: '',
    kind: 'city',
    linkMapId: null,
    authorUid: author,
    authorName: author,
    createdAt: T,
    updatedAt: T,
  });

  it('keeps personal maps private', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'users/alice/maps/m1'), personalMap));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/maps/m1')));
    await assertFails(setDoc(doc(as('bob'), 'users/alice/maps/m2'), personalMap));
    await assertFails(setDoc(doc(as('alice'), 'users/alice/maps/m3'), { ...personalMap, fingerprint: 'short' }));
  });

  it('lets only the DM create party maps, and members read them', async () => {
    await seedParty();
    await assertSucceeds(setDoc(doc(as('alice'), 'parties/p1/maps/m1'), partyMap));
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/maps/m2'), partyMap));
    await assertSucceeds(getDocs(collection(as('bob'), 'parties/p1/maps')));
    await assertFails(getDocs(collection(as('eve'), 'parties/p1/maps')));
  });

  it('lets members add their own pins, and the author or DM change them', async () => {
    await seedParty();
    await join(as('carol'), 'carol');
    await setDoc(doc(as('alice'), 'parties/p1/maps/m1'), partyMap);
    await assertSucceeds(setDoc(doc(as('bob'), 'parties/p1/maps/m1/pins/x1'), pin('bob')));
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/maps/m1/pins/x2'), pin('carol')));
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/maps/m1/pins/x3'), { ...pin('bob'), x: 1.5 }));
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/maps/nomap/pins/x4'), pin('bob')));
    await assertFails(setDoc(doc(as('eve'), 'parties/p1/maps/m1/pins/x5'), pin('eve')));
    await assertSucceeds(updateDoc(doc(as('bob'), 'parties/p1/maps/m1/pins/x1'), { title: 'Phandalin (rovine)' }));
    await assertSucceeds(updateDoc(doc(as('alice'), 'parties/p1/maps/m1/pins/x1'), { note: 'Attenti ai Cappe Rosse' }));
    await assertFails(updateDoc(doc(as('carol'), 'parties/p1/maps/m1/pins/x1'), { title: 'Mio' }));
    await assertFails(deleteDoc(doc(as('carol'), 'parties/p1/maps/m1/pins/x1')));
    await assertSucceeds(deleteDoc(doc(as('alice'), 'parties/p1/maps/m1/pins/x1')));
  });
});

describe('shared portraits', () => {
  const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const shared = { schemaVersion: 1, portrait: tiny, updatedAt: T };
  const path = (uid: string) => `parties/p1/members/${uid}/portrait/main`;

  it('lets a member publish their own portrait and the whole party read it', async () => {
    await seedParty();
    await assertSucceeds(setDoc(doc(as('bob'), path('bob')), shared));
    await assertSucceeds(getDoc(doc(as('alice'), path('bob'))));
    await assertSucceeds(getDoc(doc(as('bob'), path('bob'))));
  });

  it('keeps it from strangers and from anyone writing on behalf of another member', async () => {
    await seedParty();
    await assertSucceeds(setDoc(doc(as('bob'), path('bob')), shared));
    await assertFails(getDoc(doc(as('eve'), path('bob'))));
    await assertFails(setDoc(doc(as('alice'), path('bob')), shared));
    await assertFails(setDoc(doc(as('eve'), path('eve')), shared));
  });

  it('accepts only a small image data URL, under the id main', async () => {
    await seedParty();
    const db = as('bob');
    await assertFails(setDoc(doc(db, path('bob')), { ...shared, portrait: 'https://example.com/a.jpg' }));
    await assertFails(setDoc(doc(db, path('bob')), { ...shared, portrait: 'data:image/jpeg;base64,' + 'A'.repeat(60000) }));
    await assertFails(setDoc(doc(db, 'parties/p1/members/bob/portrait/other'), shared));
    await assertFails(setDoc(doc(db, path('bob')), { ...shared, extra: 1 }));
  });

  it('can be taken down by its owner or by the DM, not by another player', async () => {
    await seedParty();
    await join(as('carol'), 'carol');
    await assertSucceeds(setDoc(doc(as('bob'), path('bob')), shared));
    await assertFails(deleteDoc(doc(as('carol'), path('bob'))));
    await assertSucceeds(deleteDoc(doc(as('alice'), path('bob'))));
    await assertSucceeds(setDoc(doc(as('bob'), path('bob')), shared));
    await assertSucceeds(deleteDoc(doc(as('bob'), path('bob'))));
  });
});

describe('the party bestiary', () => {
  const entry = (uid: string, over: Record<string, unknown> = {}) => ({
    schemaVersion: 1,
    name: 'Gnoll',
    srdId: 'gnoll',
    creatureType: '',
    place: 'Strada per Phandalin',
    notes: '',
    revealed: ['ac'],
    custom: { ac: null, hp: '', speed: '' },
    createdBy: uid,
    createdByName: uid,
    createdAt: T,
    updatedAt: T,
    ...over,
  });
  const path = (id: string) => `parties/p1/bestiary/${id}`;

  it('lets every member add an entry as themselves, and the whole party read it', async () => {
    await seedParty();
    await assertSucceeds(setDoc(doc(as('bob'), path('e1')), entry('bob')));
    await assertSucceeds(setDoc(doc(as('alice'), path('e2')), entry('alice', { name: 'Orco', srdId: 'orc' })));
    await assertSucceeds(getDoc(doc(as('alice'), path('e1'))));
    await assertSucceeds(getDocs(collection(as('bob'), 'parties/p1/bestiary')));
  });

  it('keeps it from strangers, and refuses an entry signed as someone else', async () => {
    await seedParty();
    await assertSucceeds(setDoc(doc(as('bob'), path('e1')), entry('bob')));
    await assertFails(getDoc(doc(as('eve'), path('e1'))));
    await assertFails(setDoc(doc(as('eve'), path('e9')), entry('eve')));
    await assertFails(setDoc(doc(as('bob'), path('e3')), entry('alice')));
  });

  it('checks the entry: name, lengths, sections, unknown fields', async () => {
    await seedParty();
    const db = as('bob');
    await assertFails(setDoc(doc(db, path('e1')), entry('bob', { name: '' })));
    await assertFails(setDoc(doc(db, path('e1')), entry('bob', { notes: 'x'.repeat(2001) })));
    await assertFails(setDoc(doc(db, path('e1')), entry('bob', { revealed: Array(15).fill('ac') })));
    await assertFails(setDoc(doc(db, path('e1')), entry('bob', { extra: 1 })));
    await assertSucceeds(setDoc(doc(db, path('e1')), entry('bob', { srdId: null, creatureType: 'Drago di fiamma' })));
  });

  it('lets any member fill in notes and what is known, but not rename it or change its author', async () => {
    await seedParty();
    await assertSucceeds(setDoc(doc(as('bob'), path('e1')), entry('bob')));
    const alice = as('alice');
    await assertSucceeds(updateDoc(doc(alice, path('e1')), { notes: 'Odiano la luce', revealed: ['ac', 'hp'], updatedAt: T + 1 }));
    await assertFails(updateDoc(doc(alice, path('e1')), { name: 'Altro' }));
    await assertFails(updateDoc(doc(alice, path('e1')), { srdId: 'orc' }));
    await assertFails(updateDoc(doc(alice, path('e1')), { createdBy: 'alice' }));
    await assertFails(updateDoc(doc(as('eve'), path('e1')), { notes: 'intruso' }));
  });

  it('is deleted by its author or by the DM, not by another player', async () => {
    await seedParty();
    await join(as('carol'), 'carol');
    await assertSucceeds(setDoc(doc(as('bob'), path('e1')), entry('bob')));
    await assertFails(deleteDoc(doc(as('carol'), path('e1'))));
    await assertSucceeds(deleteDoc(doc(as('alice'), path('e1'))));
    await assertSucceeds(setDoc(doc(as('bob'), path('e2')), entry('bob')));
    await assertSucceeds(deleteDoc(doc(as('bob'), path('e2'))));
  });
});

describe('the full sheet shared with the Master', () => {
  const view = { schemaVersion: 1, character: { id: 'c1', name: 'Thalia' }, updatedAt: T };
  const path = (uid: string) => `parties/p1/members/${uid}/masterview/sheet`;

  it('is written by its owner and read by the owner and the DM only', async () => {
    await seedParty();
    await join(as('carol'), 'carol');
    await assertSucceeds(setDoc(doc(as('bob'), path('bob')), view));
    await assertSucceeds(getDoc(doc(as('bob'), path('bob'))));
    await assertSucceeds(getDoc(doc(as('alice'), path('bob'))));
    await assertFails(getDoc(doc(as('carol'), path('bob'))));
    await assertFails(getDoc(doc(as('eve'), path('bob'))));
  });

  it('cannot be written for someone else, not even by the DM, and not by a stranger', async () => {
    await seedParty();
    await assertFails(setDoc(doc(as('alice'), path('bob')), view));
    await assertFails(setDoc(doc(as('eve'), path('eve')), view));
    await assertFails(setDoc(doc(as('bob'), 'parties/p1/members/bob/masterview/other'), view));
  });

  it('is checked: known fields only, a character map', async () => {
    await seedParty();
    const db = as('bob');
    await assertFails(setDoc(doc(db, path('bob')), { ...view, extra: 1 }));
    await assertFails(setDoc(doc(db, path('bob')), { ...view, character: 'text' }));
  });

  it('is taken down by its owner or by the DM', async () => {
    await seedParty();
    await join(as('carol'), 'carol');
    await assertSucceeds(setDoc(doc(as('bob'), path('bob')), view));
    await assertFails(deleteDoc(doc(as('carol'), path('bob'))));
    await assertSucceeds(deleteDoc(doc(as('alice'), path('bob'))));
    await assertSucceeds(setDoc(doc(as('bob'), path('bob')), view));
    await assertSucceeds(deleteDoc(doc(as('bob'), path('bob'))));
  });
});

describe('treasure', () => {
  const coins = (gp = 0) => ({ cp: 0, sp: 0, ep: 0, gp, pp: 0 });
  const treasure = (over: Record<string, unknown> = {}) => ({
    schemaVersion: 1,
    title: 'Bottino del drago',
    note: '',
    coins: coins(50),
    items: [{ name: 'Spada +1', category: 'weapon', quantity: 1, weightLb: 3, valueCp: 100000, notes: '', requiresAttunement: false }],
    to: null,
    status: 'open',
    claimedBy: null,
    claimedByName: '',
    claimedAt: 0,
    createdBy: 'alice',
    createdAt: T,
    updatedAt: T,
    ...over,
  });
  const path = (id: string) => `parties/p1/treasure/${id}`;
  const claim = (uid: string) => ({ status: 'claimed', claimedBy: uid, claimedByName: uid, claimedAt: T + 1, updatedAt: T + 1 });

  it('is created, edited and deleted by the DM only, and read by the whole party', async () => {
    await seedParty();
    await assertSucceeds(setDoc(doc(as('alice'), path('t1')), treasure()));
    await assertFails(setDoc(doc(as('bob'), path('t2')), treasure({ createdBy: 'bob' })));
    await assertSucceeds(updateDoc(doc(as('alice'), path('t1')), { title: 'Altro nome', updatedAt: T + 1 }));
    await assertSucceeds(getDoc(doc(as('bob'), path('t1'))));
    await assertFails(getDoc(doc(as('eve'), path('t1'))));
    await assertFails(deleteDoc(doc(as('bob'), path('t1'))));
    await assertSucceeds(deleteDoc(doc(as('alice'), path('t1'))));
  });

  it('is checked: coins, title, items, a created treasure is open', async () => {
    await seedParty();
    const db = as('alice');
    await assertFails(setDoc(doc(db, path('t1')), treasure({ title: '' })));
    await assertFails(setDoc(doc(db, path('t1')), treasure({ coins: coins(-1) })));
    await assertFails(setDoc(doc(db, path('t1')), treasure({ coins: { gp: 5 } })));
    await assertFails(setDoc(doc(db, path('t1')), treasure({ items: Array(21).fill({}) })));
    await assertFails(setDoc(doc(db, path('t1')), treasure({ status: 'claimed', claimedBy: 'bob' })));
    await assertFails(setDoc(doc(db, path('t1')), treasure({ extra: 1 })));
  });

  it('lets a member take what is for everyone, once, changing nothing but the claim', async () => {
    await seedParty();
    await join(as('carol'), 'carol');
    await setDoc(doc(as('alice'), path('t1')), treasure());
    await assertFails(updateDoc(doc(as('bob'), path('t1')), { ...claim('bob'), coins: coins(500) }));
    await assertFails(updateDoc(doc(as('bob'), path('t1')), { ...claim('carol') }));
    await assertSucceeds(updateDoc(doc(as('bob'), path('t1')), claim('bob')));
    await assertFails(updateDoc(doc(as('carol'), path('t1')), claim('carol')));
    await assertFails(updateDoc(doc(as('alice'), path('t1')), { title: 'Troppo tardi', updatedAt: T + 2 }));
  });

  it('lets only the member it is for take an assigned treasure', async () => {
    await seedParty();
    await join(as('carol'), 'carol');
    await setDoc(doc(as('alice'), path('t1')), treasure({ to: 'bob' }));
    await assertFails(updateDoc(doc(as('carol'), path('t1')), claim('carol')));
    await assertFails(updateDoc(doc(as('eve'), path('t1')), claim('eve')));
    await assertSucceeds(updateDoc(doc(as('bob'), path('t1')), claim('bob')));
  });
});

describe('trades between members', () => {
  const item = { name: 'Pozione di cura', category: 'consumable', quantity: 2, weightLb: 0.5, valueCp: 5000, notes: '', requiresAttunement: false };
  const trade = (over: Record<string, unknown> = {}) => ({
    schemaVersion: 1,
    from: 'bob',
    fromName: 'bob',
    to: 'carol',
    toName: 'carol',
    item,
    status: 'pending',
    settled: false,
    note: '',
    createdAt: T,
    updatedAt: T,
    ...over,
  });
  const path = (id: string) => `parties/p1/trades/${id}`;
  const base = async () => {
    await seedParty();
    await join(as('carol'), 'carol');
  };

  it('is offered by a member to another member, as themselves', async () => {
    await base();
    await assertSucceeds(setDoc(doc(as('bob'), path('x1')), trade()));
    await assertFails(setDoc(doc(as('bob'), path('x2')), trade({ from: 'carol', to: 'bob' })));
    await assertFails(setDoc(doc(as('bob'), path('x3')), trade({ to: 'bob' })));
    await assertFails(setDoc(doc(as('bob'), path('x4')), trade({ to: 'eve' })));
    await assertFails(setDoc(doc(as('eve'), path('x5')), trade({ from: 'eve' })));
    await assertFails(setDoc(doc(as('bob'), path('x6')), trade({ status: 'accepted' })));
    await assertFails(setDoc(doc(as('bob'), path('x7')), trade({ settled: true })));
  });

  it('is read only by the two people involved', async () => {
    await base();
    await setDoc(doc(as('bob'), path('x1')), trade());
    await assertSucceeds(getDoc(doc(as('bob'), path('x1'))));
    await assertSucceeds(getDoc(doc(as('carol'), path('x1'))));
    await assertFails(getDoc(doc(as('alice'), path('x1'))));
    await assertFails(getDoc(doc(as('eve'), path('x1'))));
  });

  it('is accepted or declined by the receiver, cancelled by the sender, nobody else', async () => {
    await base();
    await setDoc(doc(as('bob'), path('x1')), trade());
    await assertFails(updateDoc(doc(as('bob'), path('x1')), { status: 'accepted', updatedAt: T + 1 }));
    await assertFails(updateDoc(doc(as('alice'), path('x1')), { status: 'accepted', updatedAt: T + 1 }));
    await assertFails(updateDoc(doc(as('carol'), path('x1')), { status: 'accepted', item: { ...item, quantity: 99 }, updatedAt: T + 1 }));
    await assertFails(updateDoc(doc(as('carol'), path('x1')), { status: 'cancelled', updatedAt: T + 1 }));
    await assertSucceeds(updateDoc(doc(as('carol'), path('x1')), { status: 'accepted', updatedAt: T + 1 }));
    await setDoc(doc(as('bob'), path('x2')), trade());
    await assertSucceeds(updateDoc(doc(as('bob'), path('x2')), { status: 'cancelled', updatedAt: T + 1 }));
    await setDoc(doc(as('bob'), path('x3')), trade());
    await assertSucceeds(updateDoc(doc(as('carol'), path('x3')), { status: 'declined', updatedAt: T + 1 }));
  });

  it('is settled by the side that gets the object: the receiver after accepting, the sender after a refusal', async () => {
    await base();
    await setDoc(doc(as('bob'), path('x1')), trade());
    await updateDoc(doc(as('carol'), path('x1')), { status: 'accepted', updatedAt: T + 1 });
    await assertFails(updateDoc(doc(as('bob'), path('x1')), { settled: true, updatedAt: T + 2 }));
    await assertSucceeds(updateDoc(doc(as('carol'), path('x1')), { settled: true, updatedAt: T + 2 }));

    await setDoc(doc(as('bob'), path('x2')), trade());
    await updateDoc(doc(as('carol'), path('x2')), { status: 'declined', updatedAt: T + 1 });
    await assertFails(updateDoc(doc(as('carol'), path('x2')), { settled: true, updatedAt: T + 2 }));
    await assertSucceeds(updateDoc(doc(as('bob'), path('x2')), { settled: true, updatedAt: T + 2 }));
  });

  it('can be deleted only once settled, by one of the two', async () => {
    await base();
    await setDoc(doc(as('bob'), path('x1')), trade());
    await assertFails(deleteDoc(doc(as('bob'), path('x1'))));
    await updateDoc(doc(as('carol'), path('x1')), { status: 'declined', updatedAt: T + 1 });
    await updateDoc(doc(as('bob'), path('x1')), { settled: true, updatedAt: T + 2 });
    await assertFails(deleteDoc(doc(as('alice'), path('x1'))));
    await assertSucceeds(deleteDoc(doc(as('carol'), path('x1'))));
  });
});
