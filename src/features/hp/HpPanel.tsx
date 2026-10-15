import { useId, useState } from 'react';
import { FoldCard } from '../../components/FoldCard';
import { NumberField } from '../../components/NumberField';
import { useCharacterStore } from '../../data/characterStore';
import { HP_LIMIT } from '../../domain/hp/hp';
import { LevelUpSection } from '../sheet/LevelUp';

/**
 * The rarer HP changes: temporary HP, raising the maximum, typing values by hand, level-up and the long rest.
 * Damage, healing and death saves are in the strip under the tabs.
 */
export function HpManage() {
  const hp = useCharacterStore((s) => s.character.hp);
  const { gainTemp, longRest, editHp } = useCharacterStore.getState();
  const [amount, setAmount] = useState('');
  const amountId = useId();

  const n = Math.max(0, Math.min(HP_LIMIT * 10, Math.trunc(Number(amount) || 0)));
  const apply = (fn: (v: number) => void) => {
    if (n <= 0) return;
    fn(n);
    setAmount('');
  };

  return (
    <FoldCard id="hp-manage" title="Gestione PF" summary="PF temporanei, livello, riposo" defaultOpen={false}>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field">
          <label htmlFor={amountId}>Quantità</label>
          <input id={amountId} type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button type="button" disabled={n <= 0} onClick={() => apply(gainTemp)}>
          PF temporanei
        </button>
        <button
          type="button"
          disabled={n <= 0}
          title="Alza i PF massimi e quelli attuali della quantità scritta"
          onClick={() => apply((v) => editHp({ max: hp.max + v, cur: hp.cur + v }))}
        >
          Aumenta PF massimi
        </button>
      </div>

      <details>
        <summary>Scrivi a mano PF attuali, massimi e temporanei</summary>
        <div className="row" style={{ marginTop: 'var(--space-2)' }}>
          <NumberField label="PF attuali" value={hp.cur} min={0} max={hp.max} onCommit={(cur) => editHp({ cur })} />
          <NumberField label="PF massimi" value={hp.max} min={1} max={HP_LIMIT} onCommit={(max) => editHp({ max })} />
          <NumberField label="PF temporanei" value={hp.temp} min={0} max={HP_LIMIT} onCommit={(temp) => editHp({ temp })} />
        </div>
        <p className="small muted">Scrivi il valore e premi Invio (o tocca fuori dal campo) per confermarlo.</p>
      </details>

      <LevelUpSection />

      <div>
        <button type="button" onClick={longRest}>
          Riposo lungo
        </button>
      </div>
    </FoldCard>
  );
}
