import { Hint } from '../../components/Hint';
import { useState } from 'react';
import { formatNumber } from '../../domain/format/number';
import { endCombat, endTurn, startCombat } from '../../domain/sheet/combat';
import { editSheet, useSheet } from '../sheet/sheetHooks';

/** Starts and ends the combat, and moves it forward one of my turns at a time. */
export function TurnCard() {
  const { combat } = useSheet();
  const sheet = useSheet();
  const [message, setMessage] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (!combat.active) {
    return (
      <section className="card stack span-all" aria-labelledby="turn-title">
        <h2 id="turn-title">Combat</h2>
        <Hint short="Tutto quello che serve nello scontro, in una pagina.">
          Qui trovi in una pagina quello che serve nello scontro: PF, condizioni, attacchi, tiri salvati e incantesimi. Con «Inizia
          combattimento» parte il conteggio dei round e gli effetti degli incantesimi si contano da soli.
        </Hint>
        <div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              editSheet(startCombat);
              setMessage('');
            }}
          >
            Inizia combattimento
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card stack span-all" aria-labelledby="turn-title">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="turn-title" style={{ margin: 0 }}>
          Round {formatNumber(combat.round)}
        </h2>
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={() => {
              const r = endTurn(sheet);
              editSheet(() => r.sheet);
              setMessage(
                r.expired.length > 0
                  ? `Fine turno. Effetti terminati: ${r.expired.join(', ')}.`
                  : `Fine turno. Round ${combat.round + 1}.`,
              );
            }}
          >
            Fine turno
          </button>
          {confirmEnd ? (
            <span className="row" role="group" aria-label="Conferma">
              <span className="small">Terminare il combattimento? Gli effetti attivi vengono tolti.</span>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  editSheet(endCombat);
                  setConfirmEnd(false);
                  setMessage('');
                }}
              >
                Termina
              </button>
              <button type="button" onClick={() => setConfirmEnd(false)}>
                Annulla
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmEnd(true)}>
              Termina combattimento
            </button>
          )}
        </div>
      </div>
      <p className="small muted">«Fine turno» conta un round in meno su ogni effetto a tempo e passa al round successivo.</p>
      <p className="status-line" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
