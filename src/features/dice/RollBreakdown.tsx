import type { TermResult } from '../../domain/dice/types';
import { formatNumber } from '../../domain/format/number';

/** Every die of a roll, with dropped dice struck through. */
export function RollBreakdown({ terms }: { terms: TermResult[] }) {
  return (
    <span className="breakdown">
      {terms.map((t, i) => (
        <span className="term" key={i}>
          {(i > 0 || t.sign === -1) && <span aria-hidden="true">{t.sign === -1 ? '−' : '+'}</span>}
          {i > 0 && <span className="visually-hidden">{t.sign === -1 ? 'meno' : 'più'}</span>}
          {t.flat !== undefined ? (
            <span>{formatNumber(t.flat)}</span>
          ) : (
            <>
              <span className="muted">{t.notation}</span>
              {t.dice.map((d, j) => {
                const nat = d.sides === 20 && d.kept ? (d.value === 20 ? ' nat20' : d.value === 1 ? ' nat1' : '') : '';
                return (
                  <span key={j} className={`die${d.kept ? '' : ' dropped'}${nat}`}>
                    {!d.kept && <span className="visually-hidden">scartato </span>}
                    {formatNumber(d.value)}
                  </span>
                );
              })}
            </>
          )}
        </span>
      ))}
    </span>
  );
}
