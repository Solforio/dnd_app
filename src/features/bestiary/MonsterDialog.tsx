import { useEffect, useRef } from 'react';
import { useMonsterDialog } from '../../data/monsterDialog';
import { MonsterBlock } from './MonsterBlock';

/** The window with the full stat block of a monster of the catalogue, opened from any list. */
export function MonsterDialog() {
  const monster = useMonsterDialog((s) => s.monster);
  const footer = useMonsterDialog((s) => s.footer);
  const close = useMonsterDialog((s) => s.close);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (monster && !d.open) d.showModal();
    if (!monster && d.open) d.close();
  }, [monster]);

  return (
    <dialog
      ref={ref}
      className="spell-dialog monster-dialog"
      aria-labelledby="monster-dialog-title"
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
    >
      {monster && (
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="monster-dialog-title" style={{ margin: 0 }}>
              {monster.name}
            </h2>
            <button type="button" onClick={close} autoFocus>
              Chiudi
            </button>
          </div>
          <MonsterBlock monster={monster} />
          {footer}
          <p className="small muted">Testo del System Reference Document 5.1 (CC-BY 4.0), in inglese.</p>
        </div>
      )}
    </dialog>
  );
}
