import { writeBackupState } from '../../data/backupState';
import { exportBackup } from '../../domain/backup';
import type { Character } from '../../domain/character';

/** Downloads every character in one JSON file and remembers the date, so the reminder stays quiet for a while. */
export function downloadBackup(characters: readonly Character[]): void {
  const blob = new Blob([exportBackup(characters)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dnd-pocket-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  writeBackupState({ lastBackupAt: Date.now() });
}
