import { useId, useState } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { SavePresetForm } from './SavePresetForm';

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
const MAX_PER_DIE = 20;
type Counts = Record<(typeof DICE)[number], number>;
const EMPTY: Counts = { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 };

function buildFormula(counts: Counts, modifier: number): string {
  const parts = DICE.filter((s) => counts[s] > 0).map((s) => `${counts[s]}d${s}`);
  if (parts.length === 0) return '';
  const mod = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
  return parts.join('+') + mod;
}

export function DiceTray() {
  const roll = useCharacterStore((s) => s.roll);
  const addPreset = useCharacterStore((s) => s.addPreset);
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [modifier, setModifier] = useState(0);
  const [saving, setSaving] = useState(false);
  const modId = useId();

  const formula = buildFormula(counts, modifier);
  const change = (sides: keyof Counts, delta: number) =>
    setCounts((c) => ({ ...c, [sides]: Math.min(MAX_PER_DIE, Math.max(0, c[sides] + delta)) }));

  return (
    <section className="card stack" aria-labelledby="tray-title">
      <h2 id="tray-title">Vassoio dei dadi</h2>
      <div className="tray">
        {DICE.map((s) => (
          <div className="tray-die" key={s}>
            <button
              type="button"
              className="add"
              onClick={() => change(s, 1)}
              disabled={counts[s] >= MAX_PER_DIE}
              aria-label={`Aggiungi un d${s}, ora ${counts[s]}`}
            >
              d{s}
              {counts[s] > 0 && <span className="count">×{counts[s]}</span>}
            </button>
            <button
              type="button"
              className="remove"
              onClick={() => change(s, -1)}
              disabled={counts[s] === 0}
              aria-label={`Togli un d${s}`}
            >
              −
            </button>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor={modId}>Modificatore</label>
          <input
            id={modId}
            type="number"
            inputMode="numeric"
            min={-99}
            max={99}
            value={modifier}
            onChange={(e) => setModifier(Math.max(-99, Math.min(99, Math.trunc(Number(e.target.value) || 0))))}
          />
        </div>
        <p className="formula-preview" aria-live="polite">
          <span className="visually-hidden">Formula: </span>
          {formula || <span className="muted">Nessun dado scelto</span>}
        </p>
      </div>

      {saving ? (
        <SavePresetForm
          formula={formula}
          onCancel={() => setSaving(false)}
          onSave={(name) => {
            const err = addPreset(name, formula);
            if (!err) setSaving(false);
            return err;
          }}
        />
      ) : (
        <div className="row">
          <button type="button" className="primary" disabled={!formula} onClick={() => roll(formula)}>
            Lancia
          </button>
          <button type="button" disabled={!formula} onClick={() => setSaving(true)}>
            Salva come preset
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!formula && modifier === 0}
            onClick={() => {
              setCounts(EMPTY);
              setModifier(0);
            }}
          >
            Svuota
          </button>
        </div>
      )}
    </section>
  );
}
