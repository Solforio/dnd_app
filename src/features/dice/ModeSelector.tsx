import { useId } from 'react';
import type { RollMode } from '../../domain/dice/types';
import { MODE_LABEL } from './labels';

const MODES: RollMode[] = ['normal', 'advantage', 'disadvantage'];

export function ModeSelector({ value, onChange }: { value: RollMode; onChange: (m: RollMode) => void }) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">Modalità del d20</legend>
      {MODES.map((m) => (
        <label key={m}>
          <input type="radio" name={name} value={m} checked={value === m} onChange={() => onChange(m)} />
          {MODE_LABEL[m]}
        </label>
      ))}
    </fieldset>
  );
}
