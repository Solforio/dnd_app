import { useId, useState } from 'react';
import { NumberField } from '../../components/NumberField';
import { useCharacterStore } from '../../data/characterStore';
import { formatNumber } from '../../domain/format/number';
import { HP_LIMIT } from '../../domain/hp/hp';
import { DeathSaves } from './DeathSaves';

export function HpPanel() {
  const hp = useCharacterStore((s) => s.character.hp);
  const status = useCharacterStore((s) => s.hpStatus);
  const { damage, heal, gainTemp, longRest, editHp } = useCharacterStore.getState();
  const [amount, setAmount] = useState('');
  const amountId = useId();

  const n = Math.max(0, Math.min(HP_LIMIT * 10, Math.trunc(Number(amount) || 0)));
  const apply = (fn: (v: number) => void) => {
    if (n <= 0) return;
    fn(n);
    setAmount('');
  };

  // The bar spans max HP plus any temporary HP, so both stay visible.
  const scale = hp.max + hp.temp;
  const curPct = (hp.cur / scale) * 100;
  const tempPct = (hp.temp / scale) * 100;

  return (
    <section className="card stack" aria-labelledby="hp-title">
      <h2 id="hp-title">Punti ferita</h2>

      <p className="hp-numbers">
        {formatNumber(hp.cur)}
        <span className="muted"> / {formatNumber(hp.max)}</span>
        {hp.temp > 0 && <span className="temp">+{formatNumber(hp.temp)} temporanei</span>}
      </p>
      <div
        className="hp-bar"
        role="meter"
        aria-label="PF attuali"
        aria-valuemin={0}
        aria-valuemax={hp.max}
        aria-valuenow={hp.cur}
      >
        <span className={`cur${hp.cur <= hp.max / 4 ? ' low' : ''}`} style={{ width: `${curPct}%` }} />
        <span className="temp" style={{ width: `${tempPct}%` }} />
      </div>

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field">
          <label htmlFor={amountId}>Quantità</label>
          <input
            id={amountId}
            type="number"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button type="button" className="danger" disabled={n <= 0} onClick={() => apply(damage)}>
          Danno
        </button>
        <button type="button" className="heal" disabled={n <= 0} onClick={() => apply(heal)}>
          Cura
        </button>
        <button type="button" disabled={n <= 0} onClick={() => apply(gainTemp)}>
          PF temporanei
        </button>
      </div>

      <p className="status-line" role="status" aria-live="polite">
        {status}
      </p>

      <details>
        <summary className="small muted">Modifica i valori a mano</summary>
        <div className="row" style={{ marginTop: 'var(--space-2)' }}>
          <NumberField label="PF attuali" value={hp.cur} min={0} max={hp.max} onCommit={(cur) => editHp({ cur })} />
          <NumberField label="PF massimi" value={hp.max} min={1} max={HP_LIMIT} onCommit={(max) => editHp({ max })} />
          <NumberField
            label="PF temporanei"
            value={hp.temp}
            min={0}
            max={HP_LIMIT}
            onCommit={(temp) => editHp({ temp })}
          />
        </div>
      </details>

      <DeathSaves />

      <div>
        <button type="button" onClick={longRest}>
          Riposo lungo
        </button>
      </div>
    </section>
  );
}
