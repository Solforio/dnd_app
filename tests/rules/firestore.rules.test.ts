import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dnd-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

function as(uid: string, username = uid) {
  return env.authenticatedContext(uid, { email: `${username}@dnd.local` }).firestore();
}

const userDoc = (username: string) => ({
  schemaVersion: 1,
  username,
  activeCharacterId: null,
  createdAt: 1_700_000_000_000,
});

const character = (id: string) => ({
  schemaVersion: 1,
  id,
  name: 'Thalia',
  hp: { cur: 10, max: 10, temp: 0 },
  updatedAt: 1_700_000_000_000,
});

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), userDoc('alice'));
    await setDoc(doc(db, 'users/alice/characters/c1'), character('c1'));
  });
}

describe('users/{uid}', () => {
  it('lets a user create their own profile with a matching username', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'users/alice'), userDoc('alice')));
  });

  it('refuses a username that does not match the sign-in email', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/alice'), userDoc('bob')));
  });

  it('refuses a profile for another uid, or without sign-in', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/bob'), userDoc('alice')));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice'), userDoc('alice')));
  });

  it('refuses unknown fields', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/alice'), { ...userDoc('alice'), admin: true }));
  });

  it('lets the owner change the active character but not the username', async () => {
    await seed();
    const db = as('alice');
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { activeCharacterId: 'c1' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { username: 'alicia' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { createdAt: 1 }));
  });

  it('hides a profile from other users and from anonymous visitors', async () => {
    await seed();
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice')));
    await assertFails(getDoc(doc(as('bob'), 'users/alice')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice')));
  });
});

describe('users/{uid}/characters/{id}', () => {
  it('lets the owner read, write and delete', async () => {
    await seed();
    const db = as('alice');
    await assertSucceeds(getDoc(doc(db, 'users/alice/characters/c1')));
    await assertSucceeds(setDoc(doc(db, 'users/alice/characters/c2'), character('c2')));
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/characters/c1')));
  });

  it('refuses a document whose id field does not match its path', async () => {
    await assertFails(setDoc(doc(as('alice'), 'users/alice/characters/c2'), character('other')));
  });

  it('refuses documents without a schema version', async () => {
    const noVersion: Partial<ReturnType<typeof character>> = character('c3');
    delete noVersion.schemaVersion;
    await assertFails(setDoc(doc(as('alice'), 'users/alice/characters/c3'), noVersion));
  });

  it('denies every access to another user', async () => {
    await seed();
    const db = as('bob');
    await assertFails(getDoc(doc(db, 'users/alice/characters/c1')));
    await assertFails(setDoc(doc(db, 'users/alice/characters/c1'), character('c1')));
    await assertFails(deleteDoc(doc(db, 'users/alice/characters/c1')));
  });
});

describe('everything else', () => {
  it('is denied', async () => {
    await assertFails(setDoc(doc(as('alice'), 'anything/else'), { a: 1 }));
    await assertFails(getDoc(doc(as('alice'), 'parties/p1')));
  });
});
