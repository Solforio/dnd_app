import { formatNumber } from '../../domain/format/number';
import { CONDITION_LABELS, CONDITIONS, EXHAUSTION_MAX } from '../../domain/sheet/rules';
import { editSheet, useSheet } from './sheetHooks';

/** Conditions and exhaustion are game state, so they stay clickable outside edit mode. */
export function ConditionsCard() {
  const s = useSheet();
  const active = new Set(s.conditions);

  return (
    <section className="card stack" aria-labelledby="conditions-title">
      <h2 id="conditions-title">Condizioni</h2>
      <div className="chips">
        {CONDITIONS.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip${active.has(c) ? ' on' : ''}`}
            aria-pressed={active.has(c)}
            onClick={() =>
              editSheet((x) => ({
                ...x,
                // Kept in the canonical order.
                conditions: CONDITIONS.filter((k) => (k === c ? !active.has(c) : x.conditions.includes(k))),
              }))
            }
          >
            {CONDITION_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="row" role="group" aria-labelledby="exhaustion-label">
        <span id="exhaustion-label" className="label">
          Indebolimento
        </span>
        <button
          type="button"
          aria-label="Togli un livello di indebolimento"
          disabled={s.exhaustion <= 0}
          onClick={() => editSheet((x) => ({ ...x, exhaustion: Math.max(0, x.exhaustion - 1) }))}
        >
          −
        </button>
        <span className={`exhaustion${s.exhaustion > 0 ? ' on' : ''}`} aria-live="polite">
          {formatNumber(s.exhaustion)}/{formatNumber(EXHAUSTION_MAX)}
        </span>
        <button
          type="button"
          aria-label="Aggiungi un livello di indebolimento"
          disabled={s.exhaustion >= EXHAUSTION_MAX}
          onClick={() => editSheet((x) => ({ ...x, exhaustion: Math.min(EXHAUSTION_MAX, x.exhaustion + 1) }))}
        >
          +
        </button>
      </div>
    </section>
  );
}
