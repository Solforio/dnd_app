import { formatNumber } from '../../domain/format/number';
import { CONDITION_EFFECTS, CONDITIONS_SOURCE, exhaustionEffects, impliedConditions } from '../../domain/sheet/conditionEffects';
import { CONDITION_LABELS, CONDITIONS, EXHAUSTION_MAX, type ConditionId } from '../../domain/sheet/rules';
import { ConditionGlyph } from '../icons/Glyphs';
import { editSheet, useSheet } from './sheetHooks';

/** What the active conditions do: one line each, the full SRD text on demand. */
function ActiveEffects({ conditions, exhaustion }: { conditions: ConditionId[]; exhaustion: number }) {
  const implied = impliedConditions(conditions);
  const exhausted = exhaustionEffects(exhaustion);
  if (conditions.length === 0 && exhausted.length === 0) return null;

  return (
    <div className="effects" role="group" aria-labelledby="effects-title">
      <h3 id="effects-title">Effetti attivi</h3>
      <ul className="list compact">
        {conditions.map((c) => {
          const e = CONDITION_EFFECTS[c];
          return (
            <li key={c} className="effect">
              <details>
                <summary>
                  <ConditionGlyph id={c} /> <strong>{CONDITION_LABELS[c]}</strong>: {e.summary}
                </summary>
                <ul className="effect-details small">
                  {e.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                  {e.includes && <li>Include: {e.includes.map((i) => CONDITION_LABELS[i]).join(', ')}.</li>}
                </ul>
              </details>
            </li>
          );
        })}
        {implied.map((c) => (
          <li key={`implied-${c}`} className="effect implied">
            <strong>{CONDITION_LABELS[c]}</strong> (incluso): {CONDITION_EFFECTS[c].summary}
          </li>
        ))}
        {exhausted.length > 0 && (
          <li className="effect">
            <strong>Indebolimento {formatNumber(exhaustion)}</strong>: {exhausted.join(' ')}
          </li>
        )}
      </ul>
      <p className="small muted">{CONDITIONS_SOURCE}</p>
    </div>
  );
}

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
            <ConditionGlyph id={c} /> {CONDITION_LABELS[c]}
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
      <ActiveEffects conditions={s.conditions} exhaustion={s.exhaustion} />
    </section>
  );
}
