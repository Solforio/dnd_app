import { NumberField } from '../../components/NumberField';
import { formatSigned } from '../../domain/format/number';
import { ABILITIES, ABILITY_LABELS } from '../../domain/sheet/rules';
import { abilityMod, d20Formula, saveBonus, SHEET_LIMITS } from '../../domain/sheet/sheet';
import { editSheet, rollFrom, useSheet } from './sheetHooks';

/** The six ability scores (click the modifier for a check) and the saving throws. */
export function AbilitiesCard({ editing }: { editing: boolean }) {
  const s = useSheet();

  return (
    <section className="card stack" aria-labelledby="abilities-title">
      <h2 id="abilities-title">Caratteristiche</h2>
      <div className="abilities">
        {ABILITIES.map((a) => {
          const { short, long } = ABILITY_LABELS[a];
          const mod = abilityMod(s.abilities[a]);
          return (
            <div className="ability" key={a}>
              <span className="label" title={long}>
                {short}
              </span>
              {editing ? (
                <NumberField
                  label={long}
                  hideLabel
                  value={s.abilities[a]}
                  min={1}
                  max={SHEET_LIMITS.score}
                  onCommit={(v) => editSheet((x) => ({ ...x, abilities: { ...x.abilities, [a]: v } }))}
                />
              ) : (
                <button
                  type="button"
                  className="roll-btn ability-mod"
                  aria-label={`Prova di ${long}, ${formatSigned(mod)}`}
                  onClick={() => rollFrom(d20Formula(mod), `Prova di ${long}`)}
                >
                  {formatSigned(mod)}
                </button>
              )}
              <span className="small muted">{editing ? formatSigned(mod) : s.abilities[a]}</span>
            </div>
          );
        })}
      </div>

      <h3>Tiri salvezza</h3>
      <ul className="list compact">
        {ABILITIES.map((a) => {
          const { long } = ABILITY_LABELS[a];
          const entry = s.saves[a];
          const bonus = saveBonus(s, a);
          const setSave = (patch: Partial<typeof entry>) =>
            editSheet((x) => ({ ...x, saves: { ...x.saves, [a]: { ...x.saves[a], ...patch } } }));
          return (
            <li className="check-row" key={a}>
              {editing ? (
                <>
                  <label className="inline">
                    <input type="checkbox" checked={entry.proficient} onChange={(e) => setSave({ proficient: e.target.checked })} />
                    {long}
                  </label>
                  <NumberField
                    label={`Bonus extra al tiro salvezza su ${long}`}
                    hideLabel
                    value={entry.bonus}
                    min={-SHEET_LIMITS.bonus}
                    max={SHEET_LIMITS.bonus}
                    onCommit={(b) => setSave({ bonus: b })}
                  />
                  <span className="check-total">{formatSigned(bonus)}</span>
                </>
              ) : (
                <button
                  type="button"
                  className="check-btn"
                  aria-label={`Tiro salvezza su ${long}, ${formatSigned(bonus)}${entry.proficient ? ', competente' : ''}`}
                  onClick={() => rollFrom(d20Formula(bonus), `Tiro salvezza su ${long}`)}
                >
                  <span className={`prof-dot p${entry.proficient ? 1 : 0}`} aria-hidden="true" />
                  <span>{long}</span>
                  <span className="check-total">{formatSigned(bonus)}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {editing && <p className="small muted">La casella indica la competenza; il numero è un bonus extra (per esempio un oggetto magico).</p>}
    </section>
  );
}
