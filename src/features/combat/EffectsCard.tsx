import { useId, useState } from 'react';
import { NumberField } from '../../components/NumberField';
import { TextField } from '../../components/TextField';
import { useSpellCatalogue } from '../../data/spellCatalogue';
import { newId } from '../../domain/character';
import { formatNumber } from '../../domain/format/number';
import { addEffect, COMBAT_LIMITS, removeEffect } from '../../domain/sheet/combat';
import { ReadButton } from '../grimoire/SpellRow';
import { editSheet, useSheet } from '../sheet/sheetHooks';

/** Spells and other effects running on the character, with the rounds they have left. Spell effects can be read in full. */
export function EffectsCard() {
  const { combat } = useSheet();
  const sheet = useSheet();
  const byId = useSpellCatalogue((s) => s.byId);
  const [name, setName] = useState('');
  const [rounds, setRounds] = useState(0);
  const [concentration, setConcentration] = useState(false);
  const [message, setMessage] = useState('');
  const concId = useId();

  const add = () => {
    const r = addEffect(sheet, {
      id: newId(),
      name: name.trim() || 'Effetto',
      remaining: rounds > 0 ? rounds : null,
      concentration,
      note: rounds > 0 ? '' : 'Da terminare a mano',
    });
    if (r.error) return setMessage(r.error);
    editSheet(() => r.sheet);
    setMessage(r.dropped ? `Concentrazione su ${r.dropped} interrotta.` : '');
    setName('');
    setRounds(0);
    setConcentration(false);
  };

  return (
    <section className="card stack" aria-labelledby="effects-list-title">
      <h2 id="effects-list-title">Effetti attivi</h2>
      {combat.effects.length === 0 ? (
        <p className="small muted">
          Nessun effetto. Gli incantesimi che durano aggiungono qui il loro effetto quando li lanci durante il combattimento.
        </p>
      ) : (
        <ul className="plain stack">
          {combat.effects.map((e) => {
            const spell = e.spellId ? byId.get(e.spellId) : undefined;
            return (
              <li key={e.id} className="effect-row stack-tight">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    <strong>{e.name}</strong>{' '}
                    {e.concentration && (
                      <span className="result-tag" title="Concentrazione">
                        C
                      </span>
                    )}{' '}
                    <span className="small muted">
                      {e.remaining === null ? (e.note || 'a mano') : `${formatNumber(e.remaining)} round rimasti`}
                    </span>
                  </span>
                  <span className="row">
                    {spell && <ReadButton spell={spell} />}
                    <button type="button" className="ghost" aria-label={`Termina ${e.name}`} onClick={() => editSheet((x) => removeEffect(x, e.id))}>
                      Termina
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <details>
        <summary>Aggiungi un effetto a mano</summary>
        <div className="stack" style={{ marginTop: 'var(--space-2)' }}>
          <TextField label="Nome" value={name} maxLength={COMBAT_LIMITS.name} onChange={setName} />
          <NumberField label="Round (0 = a mano)" value={rounds} min={0} max={COMBAT_LIMITS.rounds} onCommit={setRounds} />
          <label className="inline" htmlFor={concId}>
            <input id={concId} type="checkbox" checked={concentration} onChange={(e) => setConcentration(e.target.checked)} />
            Richiede concentrazione
          </label>
          <div>
            <button type="button" onClick={add}>
              Aggiungi
            </button>
          </div>
        </div>
      </details>
      <p className="status-line small" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
