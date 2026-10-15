import { useRegisterSW } from 'virtual:pwa-register/react';

/** Check for a new version this often while the app stays open. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * The service worker is registered here. A new version is downloaded in the background and waits: this notice
 * lets the user choose when to switch, so a note being typed is never lost to a reload. The first time the app
 * is ready for offline use it says so once.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => void registration.update(), CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update();
      });
    },
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="update-prompt card" role="status" aria-live="polite">
      {needRefresh ? (
        <>
          <p className="small">C’è una nuova versione di D&amp;D Pocket.</p>
          <div className="row">
            <button type="button" className="primary" onClick={() => void updateServiceWorker(true)}>
              Aggiorna
            </button>
            <button type="button" className="ghost" onClick={() => setNeedRefresh(false)}>
              Dopo
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="small">L’app è pronta anche senza connessione.</p>
          <button type="button" className="ghost" onClick={() => setOfflineReady(false)}>
            Ok
          </button>
        </>
      )}
    </div>
  );
}
