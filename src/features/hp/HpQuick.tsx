import { useId, useState } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { formatNumber } from '../../domain/format/number';
import { HP_LIMIT } from '../../domain/hp/hp';

/**
 * Phones only (hidden by CSS on wide screens): HP pinned to the top of the
 * Tiri page with quick damage and healing, so nobody scrolls past the dice.
 * The full panel below keeps the aria-live status; this line is visual only.
 */
export function HpQuick() {
  const hp = useCharacterStore((s) => s.character.hp);
  const status = useCharacterStore((s) => s.hpStatus);
  const { damage, heal } = useCharacterStore.getState();
  const [amount, setAmount] = useState('');
  const id = useId();

  const n = Math.max(0, Math.min(HP_LIMIT * 10, Math.trunc(Number(amount) || 0)));
  const apply = (fn: (v: number) => void) => {
    if (n <= 0) return;
    fn(n);
    setAmount('');
  };
  const scale = hp.max + hp.temp;

  return (
    <section className="hp-quick" aria-label="Punti ferita, accesso rapido">
      <div className="hp-quick-top">
        <span className="hp-quick-numbers">
          PF {formatNumber(hp.cur)}
          <span className="muted">/{formatNumber(hp.max)}</span>
          {hp.temp > 0 && <span className="muted small"> +{formatNumber(hp.temp)}</span>}
        </span>
        <div className="hp-bar" aria-hidden="true">
          <span className={`cur${hp.cur <= hp.max / 4 ? ' low' : ''}`} style={{ width: `${(hp.cur / scale) * 100}%` }} />
          <span className="temp" style={{ width: `${(hp.temp / scale) * 100}%` }} />
        </div>
      </div>
      <div className="hp-quick-actions">
        <label htmlFor={id} className="visually-hidden">
          Quantità di PF
        </label>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="button" className="danger" disabled={n <= 0} onClick={() => apply(damage)}>
          Danno
        </button>
        <button type="button" className="heal" disabled={n <= 0} onClick={() => apply(heal)}>
          Cura
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            document.getElementById('hp-title')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          }}
        >
          Altro
        </button>
      </div>
      {status && (
        <p className="small muted hp-quick-status" aria-hidden="true">
          {status}
        </p>
      )}
    </section>
  );
}
