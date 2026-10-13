import { DEFAULT_CHARACTER_NAME, type Character } from './character';
import { defaultInventory } from './inventory';
import { defaultSheet } from './sheet/sheet';

export type SyncStatus =
  /** Logged out: data lives only in this browser. */
  | 'local'
  /** Logged in, a change is waiting for the debounce or for the server. */
  | 'saving'
  /** Logged in, the server has every change. */
  | 'saved'
  /** Logged in but offline: changes are in the device cache and will sync later. */
  | 'offline'
  /** The last write was refused (e.g. rules or quota). */
  | 'error';

export function deriveSyncStatus(s: {
  loggedIn: boolean;
  online: boolean;
  pending: boolean;
  error: boolean;
}): SyncStatus {
  if (!s.loggedIn) return 'local';
  if (s.error) return 'error';
  if (!s.online) return 'offline';
  return s.pending ? 'saving' : 'saved';
}

/** Comparable content: the timestamp alone does not make two copies different. */
function sameContent(a: Character, b: Character): boolean {
  return JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 });
}

export interface UploadPlan {
  /** Not in the account yet: uploaded as they are. */
  fresh: Character[];
  /** Already in the account with the same content: nothing to do. */
  identical: Character[];
  /** Same id, different content: the user picks a side for each one. */
  conflicts: { local: Character; cloud: Character }[];
}

/** Decides what uploading the device's characters to the account would do. Never overwrites by itself. */
export function planUpload(local: Character[], cloud: Character[]): UploadPlan {
  const byId = new Map(cloud.map((c) => [c.id, c]));
  const plan: UploadPlan = { fresh: [], identical: [], conflicts: [] };
  for (const l of local) {
    const c = byId.get(l.id);
    if (!c) plan.fresh.push(l);
    else if (sameContent(l, c)) plan.identical.push(l);
    else plan.conflicts.push({ local: l, cloud: c });
  }
  return plan;
}

/**
 * A character created on first launch and never touched is not worth offering
 * for upload: it would only clutter the account.
 */
export function isUntouchedDefault(c: Character): boolean {
  return (
    c.name === DEFAULT_CHARACTER_NAME &&
    c.history.length === 0 &&
    c.hp.cur === c.hp.max &&
    c.hp.max === 10 &&
    c.hp.temp === 0 &&
    c.deathSaves.successes === 0 &&
    c.deathSaves.failures === 0 &&
    JSON.stringify(c.sheet) === JSON.stringify(defaultSheet()) &&
    JSON.stringify(c.inventory) === JSON.stringify(defaultInventory())
  );
}

/**
 * Coalesces rapid changes into one write: `schedule` restarts the timer,
 * `flush` writes now. The writer and the clock are injected for tests.
 */
export function createDebouncedWriter<T>(
  write: (value: T) => void,
  delayMs: number,
  clock: {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
  } = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
) {
  let handle: unknown;
  let latest: { value: T } | null = null;

  const flush = () => {
    if (handle !== undefined) clock.clearTimeout(handle);
    handle = undefined;
    if (latest === null) return;
    const { value } = latest;
    latest = null;
    write(value);
  };

  return {
    schedule(value: T) {
      latest = { value };
      if (handle !== undefined) clock.clearTimeout(handle);
      handle = clock.setTimeout(flush, delayMs);
    },
    flush,
    /** Drops a pending write without performing it (used on logout after flushing). */
    cancel() {
      if (handle !== undefined) clock.clearTimeout(handle);
      handle = undefined;
      latest = null;
    },
    get pending() {
      return latest !== null;
    },
  };
}
