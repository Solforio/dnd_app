import { useId, useState } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { formatNumber } from '../../domain/format/number';
import { HP_LIMIT } from '../../domain/hp/hp';
import { d20Formula, saveBonus } from '../../domain/sheet/sheet';
import { DeathSaves } from '../hp/DeathSaves';
import { rollFrom, useSheet } from '../sheet/sheetHooks';

/**
 * HP for the fight: the bar, damage and healing, death saves at 0, and the Constitution save after damage
 * while concentrating. The full panel (maximum HP, level-up, rests) stays on the Tiri page.
 */
export function CombatHp() {
  const hp = useCharacterStore((s) => s.character.hp);
  const status = useCharacterStore((s) => s.hpStatus);
  const check = useCharacterStore((s) => s.concentrationCheck);
  const sheet = useSheet();
  const [amount, setAmount] = useState('');
  const id = useId();
  const { damage, heal, resolveConcentration } = useCharacterStore.getState();

  const n = Math.max(0, Math.min(HP_LIMIT * 10, Math.trunc(Number(amount) || 0)));
  const apply = (fn: (v: number) => void) => {
    if (n <= 0) return;
    fn(n);
    setAmount('');
  };
  const scale = hp.max + hp.temp;

  return (
    <section className="card stack" aria-labelledby="combat-hp-title">
      <h2 id="combat-hp-title">Punti ferita</h2>
      <p className="hp-numbers">
        {formatNumber(hp.cur)}
        <span className="muted"> / {formatNumber(hp.max)}</span>
        {hp.temp > 0 && <span className="temp">+{formatNumber(hp.temp)} temporanei</span>}
      </p>
      <div className="hp-bar" role="meter" aria-label="PF attuali" aria-valuemin={0} aria-valuemax={hp.max} aria-valuenow={hp.cur}>
        <span className={`cur${hp.cur <= hp.max / 4 ? ' low' : ''}`} style={{ width: `${(hp.cur / scale) * 100}%` }} />
        <span className="temp" style={{ width: `${(hp.temp / scale) * 100}%` }} />
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field">
          <label htmlFor={id}>Quantità</label>
          <input id={id} type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button type="button" className="danger" disabled={n <= 0} onClick={() => apply(damage)}>
          Danno
        </button>
        <button type="button" className="heal" disabled={n <= 0} onClick={() => apply(heal)}>
          Cura
        </button>
      </div>
      <p className="status-line" role="status" aria-live="polite">
        {status}
      </p>

      {check && (
        <div className="concentration-check stack" role="alert">
          <p>
            <strong>Concentrazione su {check.spell}.</strong> Tiro salvezza su Costituzione, CD {formatNumber(check.dc)}.
          </p>
          <div className="row">
            <button
              type="button"
              onClick={() => rollFrom(d20Formula(saveBonus(sheet, 'con')), `Concentrazione, CD ${check.dc}`)}
            >
              Tira Costituzione
            </button>
            <button type="button" onClick={() => resolveConcentration(false)}>
              Ho mantenuto
            </button>
            <button type="button" className="danger" onClick={() => resolveConcentration(true)}>
              Perdo la concentrazione
            </button>
          </div>
        </div>
      )}

      {hp.cur === 0 && <DeathSaves />}
    </section>
  );
}
