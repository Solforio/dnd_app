import { useCharacterStore } from '../../data/characterStore';
import { canRollDeathSave, lifeState } from '../../domain/hp/hp';

const STATE_TEXT = {
  conscious: '',
  dying: 'Privo di sensi: tira i tiri salvezza contro morte.',
  stable: 'Stabile.',
  dead: 'Morto.',
} as const;

export function DeathSaves() {
  const hp = useCharacterStore((s) => s.character.hp);
  const saves = useCharacterStore((s) => s.character.deathSaves);
  const { setDeathSaves, rollDeathSave } = useCharacterStore.getState();
  const state = lifeState({ hp, deathSaves: saves });

  // Clicking the n-th pip sets the count to n, or to n - 1 if it was already n.
  const pips = (kind: 'successes' | 'failures', label: string) => (
    <div className="save-row" role="group" aria-label={label}>
      <span className="label">{label}</span>
      {[1, 2, 3].map((n) => {
        const on = saves[kind] >= n;
        return (
          <button
            key={n}
            type="button"
            className={`pip ${kind === 'successes' ? 'success' : 'failure'}`}
            aria-pressed={on}
            aria-label={`${label} ${n}`}
            onClick={() => setDeathSaves({ ...saves, [kind]: saves[kind] === n ? n - 1 : n })}
          />
        );
      })}
    </div>
  );

  return (
    <fieldset className="saves" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend>
        <h3>Tiri salvezza contro morte</h3>
      </legend>
      {pips('successes', 'Successi')}
      {pips('failures', 'Fallimenti')}
      <div className="row">
        <button type="button" disabled={!canRollDeathSave({ hp, deathSaves: saves })} onClick={rollDeathSave}>
          Tira salvezza contro morte
        </button>
        {state !== 'conscious' && <span className={`life-state ${state}`}>{STATE_TEXT[state]}</span>}
      </div>
    </fieldset>
  );
}
