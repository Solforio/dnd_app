import { useId, useState } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}

/** Integer input that commits on blur or Enter, so typing "12" does not apply "1" first. */
export function NumberField({ label, value, min, max, onCommit }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = Math.trunc(Number(draft));
    setDraft(null);
    if (draft.trim() !== '' && Number.isFinite(n) && n !== value) onCommit(Math.min(max, Math.max(min, n)));
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
    </div>
  );
}
