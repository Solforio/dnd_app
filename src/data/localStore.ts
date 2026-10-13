import { createCharacter, loadCharacter, type Character } from '../domain/character';

/**
 * Local-only storage (Phase 0 and the logged-out mode later). One localStorage
 * entry holds every character; each character still carries its own
 * schemaVersion and goes through loadCharacter.
 */
const KEY = 'dnd-companion:local';
const ENVELOPE_VERSION = 1;

interface Envelope {
  schemaVersion: number;
  activeCharacterId: string;
  characters: unknown[];
}

export interface LocalState {
  characters: Character[];
  activeCharacterId: string;
  /** Raw documents this version cannot read (e.g. saved by a newer app). Written back untouched. */
  unreadable: unknown[];
  warning?: string;
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function loadLocal(): LocalState {
  const raw = readRaw();
  const fresh = (): LocalState => {
    const c = createCharacter();
    return { characters: [c], activeCharacterId: c.id, unreadable: [] };
  };
  if (!raw) return fresh();

  let env: Partial<Envelope>;
  try {
    env = JSON.parse(raw) as Partial<Envelope>;
  } catch {
    return { ...fresh(), warning: 'I dati salvati su questo dispositivo erano illeggibili: riparto da zero.' };
  }

  const characters: Character[] = [];
  const unreadable: unknown[] = [];
  let warning: string | undefined;
  for (const doc of Array.isArray(env.characters) ? env.characters : []) {
    try {
      characters.push(loadCharacter(doc));
    } catch (e) {
      unreadable.push(doc);
      warning = e instanceof Error ? e.message : 'Un personaggio salvato non è leggibile.';
    }
  }
  if (characters.length === 0) return { ...fresh(), unreadable, warning };

  const active = characters.find((c) => c.id === env.activeCharacterId) ?? characters[0]!;
  return { characters, activeCharacterId: active.id, unreadable, warning };
}

/** Returns false when the browser refuses to store (private mode, quota). */
export function saveLocal(state: Pick<LocalState, 'characters' | 'activeCharacterId' | 'unreadable'>): boolean {
  const env: Envelope = {
    schemaVersion: ENVELOPE_VERSION,
    activeCharacterId: state.activeCharacterId,
    characters: [...state.characters, ...state.unreadable],
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}
