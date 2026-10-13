import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { accountsAvailable, signIn, signUp } from '../../data/auth';
import { useSession } from '../../data/session';
import { PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN } from '../../domain/account';

type Mode = 'signin' | 'signup';

export function SignInPage() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  if (!accountsAvailable()) {
    return (
      <main className="narrow card stack">
        <h2>Accedi</h2>
        <p>Gli account non sono ancora attivi: per ora l’app funziona solo su questo dispositivo.</p>
        <Link to="/">Torna ai dadi</Link>
      </main>
    );
  }

  if (user) {
    return (
      <main className="narrow card stack">
        <h2>Sei dentro</h2>
        <p>Hai effettuato l’accesso come {user.username}.</p>
        <Link to="/">Vai ai dadi</Link>
      </main>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = mode === 'signin' ? await signIn(username, password) : await signUp(username, password);
    setBusy(false);
    if (err) setError(err);
    else navigate('/');
  };

  const action = mode === 'signin' ? 'Accedi' : 'Crea l’account';

  return (
    <main className="narrow card stack">
      <fieldset className="segmented">
        <legend className="visually-hidden">Cosa vuoi fare</legend>
        <label>
          <input type="radio" name="auth-mode" checked={mode === 'signin'} onChange={() => setMode('signin')} />
          Accedi
        </label>
        <label>
          <input type="radio" name="auth-mode" checked={mode === 'signup'} onChange={() => setMode('signup')} />
          Registrati
        </label>
      </fieldset>

      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor={`${id}-user`}>Nome utente</label>
          <input
            id={`${id}-user`}
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={40}
            aria-describedby={`${id}-user-hint`}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <span id={`${id}-user-hint`} className="small muted">
            Da {USERNAME_MIN} a {USERNAME_MAX} caratteri: lettere, cifre, _ e -.
          </span>
        </div>
        <div className="field">
          <label htmlFor={`${id}-pass`}>Password</label>
          <input
            id={`${id}-pass`}
            type="password"
            value={password}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            aria-describedby={mode === 'signup' ? `${id}-pass-hint` : undefined}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === 'signup' && (
            <span id={`${id}-pass-hint`} className="small muted">
              Almeno {PASSWORD_MIN} caratteri, il minimo che chiede Firebase.
            </span>
          )}
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="row">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Un momento…' : action}
          </button>
          <Link to="/">Continua senza account</Link>
        </div>
      </form>

      {mode === 'signup' && (
        <p className="small muted">
          Non c’è il recupero della password: se la dimentichi, chiedi all’amministratore di reimpostarla. Usa una
          password che non usi altrove.
        </p>
      )}
      <p className="small muted">Senza account i dati restano solo su questo dispositivo.</p>
    </main>
  );
}
