import type { BackupState } from '../domain/backup';

const KEY = 'dnd-companion:backup';

export function readBackupState(): BackupState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const state: BackupState = {};
    const last = num(raw.lastBackupAt);
    const snoozed = num(raw.snoozedAt);
    if (last !== undefined) state.lastBackupAt = last;
    if (snoozed !== undefined) state.snoozedAt = snoozed;
    return state;
  } catch {
    return {};
  }
}

export function writeBackupState(patch: BackupState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readBackupState(), ...patch }));
  } catch {
    // Private mode: the banner may come back sooner than planned.
  }
}
