import type { RollRecord } from '../../domain/character';
import { formatNumber } from '../../domain/format/number';
import { MODE_LABEL } from './labels';
import { RollBreakdown } from './RollBreakdown';

const HEX = '100,6 182,53 182,147 100,194 18,147 18,53';
const TRI = '100,46 152,136 48,136';
const FACETS = [
  [100, 46, 18, 53],
  [100, 46, 182, 53],
  [100, 46, 100, 6],
  [152, 136, 182, 53],
  [152, 136, 182, 147],
  [152, 136, 100, 194],
  [48, 136, 100, 194],
  [48, 136, 18, 147],
  [48, 136, 18, 53],
];

function fontSize(text: string): number {
  if (text.length <= 2) return 58;
  if (text.length === 3) return 46;
  if (text.length <= 5) return 34;
  return 24;
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
      <svg
        key={roll?.id ?? 'empty'}
        className={`d20${state}${roll ? ' rolling' : ''}`}
        viewBox="0 0 200 200"
        role="img"
        aria-label={roll ? `Risultato ${text}` : 'Nessun tiro ancora'}
      >
        <polygon className="face" points={HEX} />
        <polygon className="facet" points={TRI} />
        {FACETS.map(([x1, y1, x2, y2], i) => (
          <line key={i} className="facet" x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
        <text className="total" x="100" y="108" textAnchor="middle" dominantBaseline="central" fontSize={fontSize(text)}>
          {text}
        </text>
      </svg>

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
