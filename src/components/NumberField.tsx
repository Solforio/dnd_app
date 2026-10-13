import { useId, useState } from 'react';
import { formatNumber } from '../domain/format/number';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
  /** Allowed decimal places; with decimals the field accepts a comma ("7,5"). */
  decimals?: number;
  /** Hides the label visually (still read by screen readers). */
  hideLabel?: boolean;
  className?: string;
}

/** Number input that commits on blur or Enter, so typing "12" does not apply "1" first. */
export function NumberField({ label, value, min, max, onCommit, decimals = 0, hideLabel, className }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const factor = 10 ** decimals;
    const n = Math.round(Number(draft.replace(',', '.')) * factor) / factor;
    setDraft(null);
    if (draft.trim() !== '' && Number.isFinite(n) && n !== value) onCommit(Math.min(max, Math.max(min, n)));
  };

  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
      <input
        id={id}
        type={decimals > 0 ? 'text' : 'number'}
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        min={min}
        max={max}
        value={draft ?? (decimals > 0 ? formatNumber(value, decimals) : value)}
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
