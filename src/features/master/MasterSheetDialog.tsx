import { useEffect, useRef, useState } from 'react';
import { getFirebase } from '../../data/firebase';
import { watchMasterView } from '../../data/partyRepo';
import type { Character } from '../../domain/character';
import { CharacterReadout } from './CharacterReadout';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; character: Character };

/** One player's shared sheet, read-only, following its changes while the window is open. */
export function MasterSheetDialog({ pid, uid, label, onClose }: { pid: string; uid: string; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) return;
    return watchMasterView(
      fb.db,
      pid,
      uid,
      (character) => setState(character ? { status: 'ready', character } : { status: 'missing' }),
      () => setState({ status: 'error' }),
    );
  }, [pid, uid]);

  return (
    <dialog
      ref={ref}
      className="spell-dialog monster-dialog"
      aria-labelledby="master-sheet-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="master-sheet-title" style={{ margin: 0 }}>
            {state.status === 'ready' ? state.character.name : label}
          </h2>
          <button type="button" onClick={() => ref.current?.close()} autoFocus>
            Chiudi
          </button>
        </div>
        {state.status === 'loading' && <p className="muted">Apro la scheda…</p>}
        {state.status === 'missing' && (
          <p>
            La scheda non è ancora arrivata: il giocatore la pubblica quando apre il gruppo con l’app aperta. Riprova tra poco.
          </p>
        )}
        {state.status === 'error' && <p className="red">Non riesco a leggere la scheda: controlla la connessione.</p>}
        {state.status === 'ready' && <CharacterReadout character={state.character} />}
        <p className="small muted">Sola lettura: il Master non può modificare la scheda di un giocatore.</p>
      </div>
    </dialog>
  );
}
