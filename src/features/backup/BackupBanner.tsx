import { useState } from 'react';
import { readBackupState, writeBackupState } from '../../data/backupState';
import { useCharacterStore } from '../../data/characterStore';
import { useSession } from '../../data/session';
import { backupDue } from '../../domain/backup';
import { isUntouchedDefault } from '../../domain/sync';
import { downloadBackup } from './downloadBackup';

/**
 * For people who are not signed in the characters live only on this device: a dismissible banner asks for a
 * backup the first time there is something worth saving and every 14 days after.
 */
export function BackupBanner() {
  const phase = useSession((s) => s.phase);
  const character = useCharacterStore((s) => s.character);
  const others = useCharacterStore((s) => s.others);
  const [hidden, setHidden] = useState(false);
  const [now] = useState(Date.now);

  const hasWork = others.length > 0 || !isUntouchedDefault(character);
  if (phase !== 'local' || hidden || !backupDue(readBackupState(), now, hasWork)) return null;

  return (
    <div className="app-notice">
      <div className="card backup-banner stack" role="region" aria-label="Backup dei personaggi">
        <p className="small">
          I tuoi personaggi sono solo su questo dispositivo: se cancelli i dati del browser li perdi. Scarica un backup, o accedi per salvarli
          sull’account.
        </p>
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={() => {
              downloadBackup([character, ...others]);
              setHidden(true);
            }}
          >
            Esporta backup
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              writeBackupState({ snoozedAt: Date.now() });
              setHidden(true);
            }}
          >
            Più tardi
          </button>
        </div>
      </div>
    </div>
  );
}
