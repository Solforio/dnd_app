import type { RollRecord } from '../../domain/character';
import { formatNumber } from '../../domain/format/number';
import { MODE_LABEL } from './labels';
import { RollBreakdown } from './RollBreakdown';
import { Die3D } from './Die3D';

/** The natural d20 of a roll, when exactly one d20 was kept: its face ends up in front. */
function naturalD20(roll: RollRecord): number | undefined {
  const kept = roll.terms.flatMap((t) => t.dice).filter((d) => d.sides === 20 && d.kept);
  return kept.length === 1 ? kept[0]!.value : undefined;
}

/** The memorable element: a large d20 showing the last total. */
export function D20Result({ roll }: { roll: RollRecord | undefined }) {
  const text = roll ? formatNumber(roll.total) : '–';
  const state = roll?.crit ? ' crit' : roll?.fumble ? ' fumble' : '';
  const modeText = roll && roll.mode !== 'normal' ? MODE_LABEL[roll.mode] : '';
  const announcement = roll
    ? `${roll.label ? `${roll.label}: ` : ''}totale ${text}. ${roll.formula}${modeText ? `, ${modeText.toLowerCase()}` : ''}.` +
      (roll.crit ? ' Critico!' : roll.fumble ? ' Fallimento critico.' : '')
    : '';

  return (
    <div className="result">
      <Die3D
        rollId={roll?.id}
        text={text}
        natural={roll ? naturalD20(roll) : undefined}
        className={state}
        label={roll ? `Risultato ${text}` : 'Nessun tiro ancora'}
      />

      {roll ? (
        <>
          <p className="result-line">
            {roll.label && <span className="muted">{roll.label} · </span>}
            {roll.formula}
            {modeText && <span className="result-tag">{modeText}</span>}
            {roll.crit && <span className="result-tag crit">Critico</span>}
            {roll.fumble && <span className="result-tag fumble">Fallimento critico</span>}
          </p>
          <RollBreakdown terms={roll.terms} />
        </>
      ) : (
        <p className="muted">Scegli i dadi o scrivi una formula, poi premi «Lancia».</p>
      )}
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
