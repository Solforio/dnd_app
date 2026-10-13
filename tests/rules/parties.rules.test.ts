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
