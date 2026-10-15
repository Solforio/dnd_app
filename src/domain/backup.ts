import { loadCharacter, type Character } from './character';
import { SchemaError } from './schema/migrate';
import { asArray, asRecord } from './schema/sanitize';

const BACKUP_KIND = 'dnd-companion/backup';
const CHARACTER_KIND = 'dnd-companion/character';

/** How often the backup banner comes back, in days. */
export const BACKUP_INTERVAL_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/** Every character of the workspace in one JSON file. */
export function exportBackup(characters: readonly Character[]): string {
  return JSON.stringify({ kind: BACKUP_KIND, exportedAt: new Date().toISOString(), characters }, null, 2);
}

export type ImportFile = { kind: 'character'; characters: [Character] } | { kind: 'backup'; characters: Character[] };

/** Reads a file exported from this app: one character, or a backup of several. Throws SchemaError otherwise. */
export function parseImport(json: string): ImportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SchemaError('Il file non è un JSON valido.');
  }
  const envelope = asRecord(parsed);
  if (envelope.kind === CHARACTER_KIND) return { kind: 'character', characters: [loadCharacter(envelope.character)] };
  if (envelope.kind === BACKUP_KIND) {
    const characters = asArray(envelope.characters, 100).map(loadCharacter);
    if (characters.length === 0) throw new SchemaError('Il backup non contiene personaggi.');
    return { kind: 'backup', characters };
  }
  throw new SchemaError('Il file non è un’esportazione di questa app.');
}

export interface BackupState {
  /** When a backup was last downloaded. */
  lastBackupAt?: number;
  /** When the banner was last sent away. */
  snoozedAt?: number;
}

/**
 * The banner shows once there is something worth saving, and then again every 14 days after the last backup
 * or after it was sent away.
 */
export function backupDue(state: BackupState, now: number, hasWork: boolean): boolean {
  if (!hasWork) return false;
  const last = Math.max(state.lastBackupAt ?? 0, state.snoozedAt ?? 0);
  return last === 0 || now - last >= BACKUP_INTERVAL_DAYS * DAY;
}
