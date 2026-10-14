import { useId, useState } from 'react';
import { NumberField } from '../../components/NumberField';
import { useCharacterStore } from '../../data/characterStore';
import { cryptoDie } from '../../domain/dice/rng';
import { formatNumber, formatSigned } from '../../domain/format/number';
import { averageRoll, hitDieOf, hitDicePools, hpGain, HIT_DIE_OPTIONS } from '../../domain/sheet/hitDice';
import { LEVEL_MAX } from '../../domain/sheet/rules';
import { abilityMod, totalLevel } from '../../domain/sheet/sheet';
import { useSheet } from './sheetHooks';

type Method = 'roll' | 'average' | 'manual';

function LevelUpForm({ onClose }: { onClose: () => void }) {
  const s = useSheet();
  const classId = useId();
  const dieId = useId();
  const [index, setIndex] = useState(0);
  const cls = s.classes[Math.min(index, s.classes.length - 1)]!;
  const [die, setDie] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>('average');
  const [rolled, setRolled] = useState<number | null>(null);
  const [manual, setManual] = useState(1);
  const [error, setError] = useState('');

  const chosenDie = die ?? hitDieOf(cls);
  const conMod = abilityMod(s.abilities.con);
  const base = method === 'average' ? averageRoll(chosenDie) : method === 'roll' ? rolled : manual;
  const gain = base === null ? null : hpGain(base, conMod);
  const reset = () => setRolled(null);

  return (
    <div className="stack levelup">
      <h3>Sali di livello</h3>
      {s.classes.length > 1 && (
        <div className="field">
          <label htmlFor={classId}>Classe che sale di livello</label>
          <select
            id={classId}
            value={index}
            onChange={(e) => {
              setIndex(Number(e.target.value));
              setDie(null);
              reset();
            }}
          >
            {s.classes.map((c, i) => (
              <option key={i} value={i}>
                {c.name.trim() || `Classe ${i + 1}`} (livello {c.level})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor={dieId}>Dado vita</label>
        <select
          id={dieId}
          value={chosenDie}
          onChange={(e) => {
            setDie(Number(e.target.value));
            reset();
          }}
        >
          {HIT_DIE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              d{d}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="plain stack">
        <legend className="label">Punti ferita guadagnati</legend>
        <label className="row">
          <input type="radio" name="levelup-method" checked={method === 'roll'} onChange={() => setMethod('roll')} />
          Tira il dado
        </label>
        <label className="row">
          <input type="radio" name="levelup-method" checked={method === 'average'} onChange={() => setMethod('average')} />
          Valore fisso ({formatNumber(averageRoll(chosenDie))})
        </label>
        <label className="row">
          <input type="radio" name="levelup-method" checked={method === 'manual'} onChange={() => setMethod('manual')} />
          Scrivo io il valore del dado
        </label>
      </fieldset>
      {method === 'roll' && (
        <div className="row">
          <button type="button" onClick={() => setRolled(cryptoDie(chosenDie))}>
            {rolled === null ? `Tira d${chosenDie}` : `Tira di nuovo d${chosenDie}`}
          </button>
          {rolled !== null && <span>Uscito {formatNumber(rolled)}</span>}
        </div>
      )}
      {method === 'manual' && (
        <NumberField label="Valore del dado" value={manual} min={1} max={30} onCommit={setManual} />
      )}
      <p className="small" aria-live="polite">
        {gain === null
          ? 'Tira il dado per vedere quanti PF guadagni.'
          : `Guadagni ${formatNumber(gain)} PF massimi (dado ${formatNumber(base!)}, COS ${formatSigned(conMod)}, almeno 1). I PF attuali salgono dello stesso valore.`}
      </p>
      {error && <p className="red">{error}</p>}
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={base === null}
          onClick={() => {
            const err = useCharacterStore.getState().levelUp(index, chosenDie, base!);
            if (err) setError(err);
            else onClose();
          }}
        >
          Conferma: livello {formatNumber(cls.level + 1)}
        </button>
        <button type="button" onClick={onClose}>
          Annulla
        </button>
      </div>
    </div>
  );
}

/** Hit dice (spend to heal, regained on a long rest) and the level-up flow that raises max HP. */
export function HitDiceCard() {
  const s = useSheet();
  const full = useCharacterStore((x) => x.character.hp.cur >= x.character.hp.max);
  const [open, setOpen] = useState(false);
  const pools = hitDicePools(s);
  const atCap = totalLevel(s.classes) >= LEVEL_MAX;
  const spend = (i: number) => useCharacterStore.getState().spendHitDie(i);

  return (
    <section className="card stack" aria-labelledby="hitdice-title">
      <h2 id="hitdice-title">Dadi vita e livello</h2>
      <ul className="plain stack">
        {pools.map((p) => (
          <li key={p.index} className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              {p.name}: d{p.die}, {formatNumber(p.left)}/{formatNumber(p.total)} disponibili
            </span>
            <button
              type="button"
              disabled={p.left <= 0 || full}
              title={full ? 'I PF sono già al massimo' : undefined}
              aria-label={`Spendi un dado vita d${p.die} di ${p.name}`}
              onClick={() => spend(p.index)}
            >
              Spendi d{p.die}
            </button>
          </li>
        ))}
      </ul>
      <p className="small muted">
        Spendere un dado tira il dado più il modificatore di COS e cura quei PF, di solito durante un riposo breve. Il riposo
        lungo restituisce metà dei dadi vita totali (almeno uno).
      </p>
      {open ? (
        <LevelUpForm onClose={() => setOpen(false)} />
      ) : (
        <div>
          <button type="button" disabled={atCap} onClick={() => setOpen(true)}>
            {atCap ? 'Livello massimo raggiunto' : 'Sali di livello'}
          </button>
        </div>
      )}
    </section>
  );
}
