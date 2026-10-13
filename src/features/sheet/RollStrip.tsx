import { useCharacterStore } from '../../data/characterStore';
import { formatNumber } from '../../domain/format/number';
import { MODE_LABEL } from '../dice/labels';
import { ModeSelector } from '../dice/ModeSelector';
import { RollBreakdown } from '../dice/RollBreakdown';

/** Compact last roll for the sheet: the total, what was rolled and every die, plus the d20 mode. */
export function RollStrip() {
  const roll = useCharacterStore((s) => s.character.history[0]);
  const rollMode = useCharacterStore((s) => s.character.rollMode);
  const setRollMode = useCharacterStore((s) => s.setRollMode);
  const state = roll?.crit ? ' crit' : roll?.fumble ? ' fumble' : '';
  const modeText = roll && roll.mode !== 'normal' ? MODE_LABEL[roll.mode] : '';

  return (
    <section className="card roll-strip" aria-label="Ultimo tiro">
      <div className="roll-strip-result">
        <span key={roll?.id ?? 'none'} className={`strip-total${state}${roll ? ' pop' : ''}`} aria-hidden="true">
          {roll ? formatNumber(roll.total) : '–'}
        </span>
        <div className="strip-detail">
          {roll ? (
            <>
              <p className="small">
                <strong>{roll.label ?? 'Tiro'}</strong> <span className="muted">{roll.formula}</span>
                {modeText && <span className="result-tag">{modeText}</span>}
                {roll.crit && <span className="result-tag crit">Critico</span>}
                {roll.fumble && <span className="result-tag fumble">Fallimento critico</span>}
              </p>
              <RollBreakdown terms={roll.terms} />
            </>
          ) : (
            <p className="small muted">Tocca un valore della scheda per tirarlo.</p>
          )}
        </div>
      </div>
      <ModeSelector value={rollMode} onChange={setRollMode} />
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {roll
          ? `${roll.label ?? 'Tiro'}: totale ${formatNumber(roll.total)}.` +
            (roll.crit ? ' Critico!' : roll.fumble ? ' Fallimento critico.' : '')
          : ''}
      </p>
    </section>
  );
}
