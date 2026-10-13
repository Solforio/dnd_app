import { useId, useState, type FormEvent } from 'react';

interface Props {
  formula: string;
  onSave: (name: string) => string | null;
  onCancel: () => void;
}

/** Inline form that asks for a preset name. */
export function SavePresetForm({ formula, onSave, onCancel }: Props) {
  const id = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = onSave(name);
    if (err) setError(err);
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor={id}>
          Nome del preset per <code>{formula}</code>
        </label>
        <input
          id={id}
          value={name}
          maxLength={80}
          placeholder="Es. Arco lungo: attacco"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          autoFocus
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" className="primary">
          Salva preset
        </button>
        <button type="button" onClick={onCancel}>
          Annulla
        </button>
      </div>
    </form>
  );
}
