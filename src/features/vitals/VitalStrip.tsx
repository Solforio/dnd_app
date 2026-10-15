import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useCharacterStore } from '../../data/characterStore';
import { formatNumber } from '../../domain/format/number';
import { HP_LIMIT } from '../../domain/hp/hp';
import { classSummary } from '../../domain/sheet/sheet';
import { DeathSaves } from '../hp/DeathSaves';
import { CharacterAvatar } from '../portrait/Avatar';
import { CONDITION_LABELS } from '../../domain/sheet/rules';
import { ConditionGlyph } from '../icons/Glyphs';
import { ConcentrationCheck } from './ConcentrationCheck';

/**
 * Always under the tabs: who is playing, HP with quick damage and healing, armour class and, in a fight,
 * the round. Damage, healing and death saves are handled here on every page; the rarer HP changes
 * (temporary and maximum HP, level-up, rests) are in «Gestione PF» on the Tiri page.
 */
export function VitalStrip() {
  const character = useCharacterStore((s) => s.character);
  const status = useCharacterStore((s) => s.hpStatus);
  const { damage, heal } = useCharacterStore.getState();
  const [amount, setAmount] = useState('');
  const id = useId();
  const strip = useRef<HTMLElement>(null);
  const { hp, sheet } = character;

  // Whatever sticks below this strip (the roll strip on Scheda and Combattimento) needs its height.
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty('--vital-h', `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--vital-h');
    };
  }, []);

  const n = Math.max(0, Math.min(HP_LIMIT * 10, Math.trunc(Number(amount) || 0)));
  const apply = (fn: (v: number) => void) => {
    if (n <= 0) return;
    fn(n);
    setAmount('');
  };
  const scale = hp.max + hp.temp;

  return (
    <section ref={strip} className="vital-strip" aria-label="Personaggio e punti ferita">
      <div className="vital-main">
        <div className="vital-who">
          <CharacterAvatar characterId={character.id} name={character.name} size={36} />
          <div>
            <strong className="vital-name">{character.name || 'Senza nome'}</strong>
            <span className="small muted vital-class">{classSummary(sheet.classes)}</span>
          </div>
        </div>

        <div className="vital-hp">
          <span className="vital-numbers">
            {formatNumber(hp.cur)}
            <span className="muted">/{formatNumber(hp.max)}</span>
            {hp.temp > 0 && <span className="muted small"> +{formatNumber(hp.temp)}</span>}
            <span className="small muted"> PF</span>
          </span>
          <div className="hp-bar" role="meter" aria-label="PF attuali" aria-valuemin={0} aria-valuemax={hp.max} aria-valuenow={hp.cur}>
            <span className={`cur${hp.cur <= hp.max / 4 ? ' low' : hp.cur <= hp.max / 2 ? ' mid' : ''}`} style={{ width: `${(hp.cur / scale) * 100}%` }} />
            <span className="temp" style={{ width: `${(hp.temp / scale) * 100}%` }} />
          </div>
        </div>

        <div className="vital-quick">
          <label htmlFor={id} className="visually-hidden">
            Quantità di PF
          </label>
          <input id={id} type="number" inputMode="numeric" min={0} placeholder="Valore" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button type="button" className="danger" disabled={n <= 0} onClick={() => apply(damage)}>
            Danno
          </button>
          <button type="button" className="heal" disabled={n <= 0} onClick={() => apply(heal)}>
            Cura
          </button>
          <span className="vital-steps" role="group" aria-label="Variazioni rapide">
            {[-5, -1, 1, 5].map((d) => (
              <button key={d} type="button" className="ghost" onClick={() => (d < 0 ? damage(-d) : heal(d))}>
                {d < 0 ? `−${-d}` : `+${d}`}
              </button>
            ))}
          </span>
        </div>

        <div className="vital-badges">
          <span className="vital-badge" title="Classe armatura">
            <span className="small muted">CA</span> {formatNumber(sheet.ac)}
          </span>
          {sheet.conditions.map((c) => (
            <span key={c} className="vital-condition" title={CONDITION_LABELS[c]} role="img" aria-label={CONDITION_LABELS[c]}>
              <ConditionGlyph id={c} />
            </span>
          ))}
          {sheet.combat.active && (
            <Link to="/combattimento" className="vital-badge live" aria-label={`Combattimento, round ${sheet.combat.round}`}>
              Round {formatNumber(sheet.combat.round)}
            </Link>
          )}
        </div>
      </div>

      <p className="small muted vital-status" role="status" aria-live="polite">
        {status}
      </p>
      <ConcentrationCheck />
      {hp.cur === 0 && <DeathSaves />}
    </section>
  );
}
