import { useState } from 'react';
import { Link } from 'react-router';
import { ThemeToggle } from '../../components/ThemeToggle';
import { accountsAvailable } from '../../data/auth';
import { requestSignOut, useSession } from '../../data/session';
import { SyncBadge } from './SyncBadge';

export function AccountBar() {
  const phase = useSession((s) => s.phase);
  const user = useSession((s) => s.user);
  const [askForce, setAskForce] = useState(false);
  const [busy, setBusy] = useState(false);

  const signOut = async (force: boolean) => {
    setBusy(true);
    const result = await requestSignOut(force);
    setBusy(false);
    setAskForce(result === 'unsynced');
  };

  return (
    <div className="row account-bar">
      <ThemeToggle />
      <SyncBadge />
      {phase === 'cloud' && user ? (
        askForce ? (
          <div className="row" role="group" aria-label="Conferma uscita">
            <span className="small">Sei offline e alcune modifiche non sono ancora sull’account: se esci ora le perdi.</span>
            <button type="button" className="danger" onClick={() => void signOut(true)} autoFocus>
              Esci comunque
            </button>
            <button type="button" onClick={() => setAskForce(false)}>
              Resta
            </button>
          </div>
        ) : (
          <>
            <span className="username">{user.username}</span>
            <button type="button" disabled={busy} onClick={() => void signOut(false)}>
              Esci
            </button>
          </>
        )
      ) : (
        phase === 'local' &&
        accountsAvailable() && (
          <Link className="button-link" to="/accedi">
            Accedi
          </Link>
        )
      )}
    </div>
  );
}
