import { useEffect, useState } from 'react';
import { getImage } from '../../data/imageStore';
import { accountImageMeta, removeAccountImage, uploadAccountImage } from '../../data/imageSync';
import { getFirebase } from '../../data/firebase';
import { useSession } from '../../data/session';

type State = 'checking' | 'device-only' | 'in-account' | 'working';

/**
 * Lets the user keep a copy of this map's image in their own account, so it appears on all their
 * devices by itself. The copy is private to the account; nothing is published.
 */
export function ImageSyncControl({ fingerprint }: { fingerprint: string }) {
  const phase = useSession((s) => s.phase);
  const user = useSession((s) => s.user);
  const [state, setState] = useState<State>('checking');
  const [message, setMessage] = useState('');
  const fb = phase === 'cloud' && user ? getFirebase() : null;

  useEffect(() => {
    if (!fb || !user) return;
    let cancelled = false;
    accountImageMeta(fb.db, user.uid, fingerprint)
      .then((meta) => !cancelled && setState(meta ? 'in-account' : 'device-only'))
      .catch(() => !cancelled && setState('device-only'));
    return () => {
      cancelled = true;
    };
  }, [fb, user, fingerprint]);

  if (!fb || !user) {
    return <p className="small muted">Accedi per tenere questa immagine nel tuo account e ritrovarla su ogni dispositivo.</p>;
  }

  const upload = async () => {
    setState('working');
    setMessage('');
    try {
      const img = await getImage(fingerprint);
      if (!img) throw new Error('L’immagine non è su questo dispositivo.');
      await uploadAccountImage(fb.db, user.uid, img);
      setState('in-account');
      setMessage('Immagine salvata nel tuo account.');
    } catch (e) {
      setState('device-only');
      setMessage(e instanceof Error ? e.message : 'Salvataggio non riuscito: controlla la connessione e riprova.');
    }
  };

  const remove = async () => {
    setState('working');
    try {
      await removeAccountImage(fb.db, user.uid, fingerprint);
      setState('device-only');
      setMessage('Immagine tolta dal tuo account (resta su questo dispositivo).');
    } catch {
      setState('in-account');
      setMessage('Non sono riuscito a toglierla: riprova.');
    }
  };

  return (
    <section className="card stack" aria-labelledby="image-sync-title">
      <h3 id="image-sync-title">Immagine su tutti i miei dispositivi</h3>
      {state === 'in-account' ? (
        <>
          <p className="small">L’immagine è nel tuo account: sugli altri tuoi dispositivi si apre senza doverla caricare.</p>
          <div>
            <button type="button" className="ghost" onClick={() => void remove()}>
              Togli dall’account
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="small muted">
            Ora l’immagine è solo su questo dispositivo. Puoi salvarne una copia nel tuo account (privata, fino a 3 MB): non è visibile a
            nessun altro.
          </p>
          <div>
            <button type="button" disabled={state !== 'device-only'} onClick={() => void upload()}>
              {state === 'working' ? 'Un momento…' : state === 'checking' ? 'Controllo…' : 'Salva nel mio account'}
            </button>
          </div>
        </>
      )}
      <p className="status-line small" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
