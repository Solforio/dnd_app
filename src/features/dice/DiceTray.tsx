import { useId, useState } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { isDefaultTray, MAX_PER_DIE, TRAY_DICE, trayFormula, useTray } from '../../data/trayStore';
import { DieIcon } from './DieIcon';
import { SavePresetForm } from './SavePresetForm';

export function DiceTray() {
  const roll = useCharacterStore((s) => s.roll);
  const addPreset = useCharacterStore((s) => s.addPreset);
  const tray = useTray();
  const { counts, modifier, add, setModifier, reset } = tray;
  const [saving, setSaving] = useState(false);
  // Counts the taps on each die; a new value restarts its small wobble.
  const [taps, setTaps] = useState<Record<number, number>>({});
  const tap = (sides: number) => setTaps((t) => ({ ...t, [sides]: (t[sides] ?? 0) + 1 }));
  const modId = useId();

  const formula = trayFormula(tray);

  return (
    <section className="card stack" aria-labelledby="tray-title">
      <h2 id="tray-title">Vassoio dei dadi</h2>
      <div className="tray">
        {TRAY_DICE.map((s) => (
          <div className="tray-die" key={s}>
            <button
              type="button"
              className="add"
              onClick={() => {
                add(s, 1);
                tap(s);
              }}
              disabled={counts[s] >= MAX_PER_DIE}
              aria-label={`Aggiungi un d${s}, ora ${counts[s]}`}
            >
              <span key={taps[s] ?? 0} className={`die-face${(taps[s] ?? 0) > 0 ? ' tapped' : ''}`}>
                <DieIcon sides={s} size={40} />
              </span>
              <span className="die-name">
                d{s}
                {counts[s] > 0 && <span className="count">×{counts[s]}</span>}
              </span>
            </button>
            <button
              type="button"
              className="remove"
              onClick={() => {
                add(s, -1);
                tap(s);
              }}
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
            onChange={(e) => setModifier(Number(e.target.value))}
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
          <button type="button" className="ghost" disabled={isDefaultTray(tray)} onClick={reset}>
            Torna a 1d20
          </button>
        </div>
      )}
    </section>
  );
}
