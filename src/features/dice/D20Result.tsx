import { useState } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { trayFormula, useTray } from '../../data/trayStore';
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

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + 0.2;
  const reach = 90 + (i % 3) * 28;
  return { dx: Math.round(Math.cos(angle) * reach), dy: Math.round(Math.sin(angle) * reach), delay: (i % 4) * 0.05 };
});

/** A burst of gold stars around the die when it settles on a critical hit (hidden when animations are off). */
function Sparkles() {
  return (
    <span className="sparkles" aria-hidden="true">
      {SPARKS.map((s, i) => (
        <i key={i} style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, animationDelay: `${1.05 + s.delay}s` } as React.CSSProperties} />
      ))}
    </span>
  );
}

/** The memorable element: a large d20 showing the last total. */
export function D20Result({ roll }: { roll: RollRecord | undefined }) {
  // The roll already on screen when the page opens does not throw sparks again.
  const [shownAtOpen] = useState(roll?.id);
  const tray = useTray();
  const chosen = trayFormula(tray);
  const rollChosen = useCharacterStore((s) => s.roll);
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
      <div className="die-stage">
        <Die3D
          rollId={roll?.id}
          text={text}
          sides={sides}
          natural={roll ? naturalRoll(roll, sides) : undefined}
          className={state}
          label={roll ? `Risultato ${text}` : 'Nessun tiro ancora'}
          onRoll={chosen ? () => rollChosen(chosen) : undefined}
          rollLabel={`Lancia ${chosen}`}
        />
        {roll?.crit && roll.id !== shownAtOpen && <Sparkles key={roll.id} />}
      </div>
      <p className="small muted die-hint">
        {chosen ? (
          <>
            Tocca il dado per lanciare <code>{chosen}</code>
          </>
        ) : (
          'Scegli almeno un dado nel vassoio.'
        )}
      </p>

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
        <p className="muted small">Cambia i dadi nel vassoio o scrivi una formula libera.</p>
      )}
      <DiceMotionControl />
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
