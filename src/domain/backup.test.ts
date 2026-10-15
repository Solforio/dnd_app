import { describe, expect, it } from 'vitest';
import { createCharacter, exportCharacter } from './character';
import { BACKUP_INTERVAL_DAYS, backupDue, exportBackup, parseImport } from './backup';

const DAY = 24 * 60 * 60 * 1000;

describe('backup file', () => {
  it('round-trips several characters', () => {
    const a = { ...createCharacter('Thalia'), id: 'a' };
    const b = { ...createCharacter('Borin'), id: 'b' };
    const file = parseImport(exportBackup([a, b]));
    expect(file.kind).toBe('backup');
    expect(file.characters.map((c) => c.name)).toEqual(['Thalia', 'Borin']);
  });

  it('still reads the file of a single character', () => {
    const file = parseImport(exportCharacter({ ...createCharacter('Thalia'), id: 'a' }));
    expect(file.kind).toBe('character');
    expect(file.characters[0]?.name).toBe('Thalia');
  });

  it('refuses other files, and an empty backup', () => {
    expect(() => parseImport('not json')).toThrow(/JSON/);
    expect(() => parseImport('{"kind":"other"}')).toThrow(/esportazione/);
    expect(() => parseImport(exportBackup([]))).toThrow(/non contiene/);
  });
});

describe('backupDue', () => {
  const now = 1_000 * DAY;

  it('stays quiet until there is something to save', () => {
    expect(backupDue({}, now, false)).toBe(false);
  });

  it('shows the first time there is something to save', () => {
    expect(backupDue({}, now, true)).toBe(true);
  });

  it('waits the interval after a backup, or after being sent away', () => {
    expect(backupDue({ lastBackupAt: now - 3 * DAY }, now, true)).toBe(false);
    expect(backupDue({ snoozedAt: now - (BACKUP_INTERVAL_DAYS - 1) * DAY }, now, true)).toBe(false);
    expect(backupDue({ lastBackupAt: now - BACKUP_INTERVAL_DAYS * DAY }, now, true)).toBe(true);
  });

  it('counts from the most recent of the two', () => {
    expect(backupDue({ lastBackupAt: now - 30 * DAY, snoozedAt: now - DAY }, now, true)).toBe(false);
  });
});
