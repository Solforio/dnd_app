import { formatNumber, formatSigned } from '../../domain/format/number';
import { ABILITIES, ABILITY_LABELS } from '../../domain/sheet/rules';
import { d20Formula, initiative, saveBonus, sheetProficiency } from '../../domain/sheet/sheet';
import { spellClassOf, spellStats } from '../../domain/spells';
import { rollFrom, useSheet, useSpeedPenalty } from '../sheet/sheetHooks';

/**
 * The numbers needed in a fight, read-only mirrors of the sheet (they are changed on the Scheda page):
 * armour class, initiative, speed, proficiency, the six saving throws and, for casters, save DC and spell attack.
 */
export function KeyStats() {
  const s = useSheet();
  const penalty = useSpeedPenalty();
  const init = initiative(s);
  const casters = s.classes.flatMap((c) => {
    const sc = spellClassOf(c);
    return sc ? [{ sc, ...spellStats(s, sc) }] : [];
  });

  return (
    <section className="card stack span-all" aria-labelledby="keystats-title">
      <h2 id="keystats-title">In breve</h2>
      <div className="stats">
        <div className="stat">
          <span className="label">CA</span>
          <span className="stat-value">{formatNumber(s.ac)}</span>
        </div>
        <div className="stat">
          <span className="label">Iniziativa</span>
          <button type="button" className="roll-btn" aria-label={`Tira l’iniziativa, ${formatSigned(init)}`} onClick={() => rollFrom(d20Formula(init), 'Iniziativa')}>
            {formatSigned(init)}
          </button>
        </div>
        <div className="stat">
          <span className="label">Velocità</span>
          <span className="stat-value">
            {formatNumber(Math.max(0, s.speedM - penalty), 1)} m{penalty > 0 && <span className="small red"> (−{formatNumber(penalty)} ingombro)</span>}
          </span>
        </div>
        <div className="stat">
          <span className="label">Bonus competenza</span>
          <span className="stat-value">{formatSigned(sheetProficiency(s))}</span>
        </div>
        {casters.map(({ sc, dc, attack }) => (
          <div className="stat" key={sc.key}>
            <span className="label">{sc.label}: CD · attacco</span>
            <span className="stat-value">
              {formatNumber(dc)} ·{' '}
              <button
                type="button"
                className="roll-btn"
                aria-label={`Tira l’attacco con incantesimo di ${sc.label}, ${formatSigned(attack)}`}
                onClick={() => rollFrom(d20Formula(attack), `Attacco con incantesimo (${sc.label})`)}
              >
                {formatSigned(attack)}
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="row save-chips" role="group" aria-label="Tiri salvezza">
        {ABILITIES.map((a) => {
          const bonus = saveBonus(s, a);
          return (
            <button
              key={a}
              type="button"
              className="chip"
              aria-label={`Tiro salvezza di ${ABILITY_LABELS[a].long}, ${formatSigned(bonus)}`}
              onClick={() => rollFrom(d20Formula(bonus), `Salvezza ${ABILITY_LABELS[a].long}`)}
            >
              {ABILITY_LABELS[a].short} {formatSigned(bonus)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
