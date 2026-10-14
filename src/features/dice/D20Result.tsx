import type { RollRecord } from '../../domain/character';
import { formatNumber } from '../../domain/format/number';
import { MODE_LABEL } from './labels';
import { RollBreakdown } from './RollBreakdown';
import { Die3D } from './Die3D';
import { DiceMotionControl } from './DiceMotionControl';

/** The die drawn: the first kind of die in the formula, a d20 when the roll has none. */
function shownSides(roll: RollRecord | undefined): number {
  return roll?.terms.find((t) => t.dice.length > 0)?.dice[0]!.sides ?? 20;
}

/** The natural roll of the drawn die, when exactly one of that kind was kept: its face ends up in front. */
function naturalRoll(roll: RollRecord, sides: number): number | undefined {
  if (sides === 100) return undefined;
  const kept = roll.terms.flatMap((t) => t.dice).filter((d) => d.sides === sides && d.kept);
  return kept.length === 1 ? kept[0]!.value : undefined;
}

/** The memorable element: a large d20 showing the last total. */
export function D20Result({ roll }: { roll: RollRecord | undefined }) {
  const text = roll ? formatNumber(roll.total) : '–';
  const sides = shownSides(roll);
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
        sides={sides}
        natural={roll ? naturalRoll(roll, sides) : undefined}
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
      <DiceMotionControl />
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
