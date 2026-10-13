import { useId, useState, type FormEvent } from 'react';
import { useCharacterStore } from '../../data/characterStore';
import { parseFormula } from '../../domain/dice/parser';
import { SavePresetForm } from './SavePresetForm';

export function FormulaRoller() {
  const roll = useCharacterStore((s) => s.roll);
  const addPreset = useCharacterStore((s) => s.addPreset);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(roll(text));
  };

  const startSaving = () => {
    const parsed = parseFormula(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSaving(true);
  };

  return (
    <section className="card stack" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Formula libera</h2>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor={id}>Formula</label>
          <input
            id={id}
            value={text}
            placeholder="Es. d20+5, 2d6+1d4+3, 4d6kh3"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={200}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
        </div>
        {error && (
          <p id={errorId} className="error" role="alert">
            {error}
          </p>
        )}
        {!saving && (
          <div className="row">
            <button type="submit" className="primary" disabled={!text.trim()}>
              Lancia
            </button>
            <button type="button" disabled={!text.trim()} onClick={startSaving}>
              Salva come preset
            </button>
          </div>
        )}
      </form>
      {saving && (
        <SavePresetForm
          formula={text.trim()}
          onCancel={() => setSaving(false)}
          onSave={(name) => {
            const err = addPreset(name, text);
            if (!err) setSaving(false);
            return err;
          }}
        />
      )}
      <p className="muted small">
        Puoi tenere o scartare dadi: <code>kh</code> tiene i più alti, <code>kl</code> i più bassi, <code>dh</code> e{' '}
        <code>dl</code> scartano. Il vantaggio si applica a ogni <code>d20</code> singolo.
      </p>
    </section>
  );
}
