import { useId } from 'react';
import { useDiceMotion, systemReducesMotion, type DiceMotion } from '../../data/motionPref';

const LABEL: Record<DiceMotion, string> = { auto: 'Come il sistema', on: 'Sempre', off: 'Mai' };

/** The choice of whether dice move, with an explanation when the system has switched animations off. */
export function DiceMotionControl() {
  const mode = useDiceMotion((s) => s.mode);
  const set = useDiceMotion((s) => s.set);
  const id = useId();
  const blocked = mode === 'auto' && systemReducesMotion();

  return (
    <div className="stack-tight motion-control">
      <div className="row">
        <label htmlFor={id} className="small muted">
          Animazioni
        </label>
        <select id={id} value={mode} onChange={(e) => set(e.target.value as DiceMotion)}>
          {(Object.keys(LABEL) as DiceMotion[]).map((m) => (
            <option key={m} value={m}>
              {LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      {blocked && (
        <p className="small" role="status">
          Il tuo dispositivo ha le animazioni ridotte, per questo il dado e gli effetti dell’app non si muovono.{' '}
          <button type="button" className="link" onClick={() => set('on')}>
            Attiva le animazioni
          </button>
        </p>
      )}
    </div>
  );
}
