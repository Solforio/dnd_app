import { useId } from 'react';

interface Props {
  label: string;
  value: string;
  maxLength: number;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

/** Labelled text input (or textarea) that saves on every keystroke; the store debounces writes. */
export function TextField({ label, value, maxLength, onChange, multiline, placeholder, className }: Props) {
  const id = useId();
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} value={value} maxLength={maxLength} rows={4} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
