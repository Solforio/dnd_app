import { useSession } from '../../data/session';
import { deriveSyncStatus, type SyncStatus } from '../../domain/sync';

const TEXT: Record<SyncStatus, string> = {
  local: 'Solo su questo dispositivo',
  saving: 'Salvataggio…',
  saved: 'Salvato',
  offline: 'Offline: salvato sul dispositivo',
  error: 'Salvataggio non riuscito',
};

export function SyncBadge() {
  const s = useSession();
  const status = deriveSyncStatus({
    loggedIn: s.phase === 'cloud',
    online: s.online,
    pending: s.debouncing || s.inFlight > 0,
    error: s.writeError !== null,
  });
  return (
    <span className={`sync-badge ${status}`} role="status" aria-live="polite" title={s.writeError ?? undefined}>
      <span className="dot" aria-hidden="true" />
      {TEXT[status]}
    </span>
  );
}
