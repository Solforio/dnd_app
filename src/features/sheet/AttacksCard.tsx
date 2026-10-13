import { useId, useState } from 'react';
import { NumberField } from '../../components/NumberField';
import { TextField } from '../../components/TextField';
import { newId } from '../../domain/character';
import { parseFormula } from '../../domain/dice/parser';
import { formatSigned } from '../../domain/format/number';
import { ABILITIES, ABILITY_LABELS } from '../../domain/sheet/rules';
import { attackBonus, attackFormula, damageFormula, SHEET_LIMITS, type Attack } from '../../domain/sheet/sheet';
import { editSheet, replaceById, rollFrom, useSheet } from './sheetHooks';

function newAttack(): Attack {
  return {
    id: newId(),
    name: 'Nuovo attacco',
    ability: 'str',
    proficient: true,
    bonus: 0,
    damage: '1d6',
    addAbilityToDamage: true,
    damageBonus: 0,
    damageType: '',
    notes: '',
  };
}

/** Damage dice field: accepted only when it parses, then stored in canonical form. */
function DamageField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const commit = () => {
    if (draft === null) return;
    if (draft.trim() === '') {
      onCommit('');
      setDraft(null);
      setError('');
      return;
    }
    const parsed = parseFormula(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onCommit(parsed.formula.text);
    setDraft(null);
    setError('');
  };
  return (
    <div className="field">
      <label htmlFor={id}>Dadi di danno</label>
      <input
        id={id}
        value={draft ?? value}
        placeholder="1d8"
        maxLength={100}
        aria-invalid={error !== ''}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      {error && (
        <span id={`${id}-err`} className="error">
          {error}
        </span>
      )}
    </div>
  );
}

function AttackEditor({ attack }: { attack: Attack }) {
  const abilityId = useId();
  const set = (patch: Partial<Attack>) => editSheet((x) => ({ ...x, attacks: replaceById(x.attacks, attack.id, patch) }));
  return (
    <fieldset className="plain attack-edit">
      <legend className="visually-hidden">{attack.name}</legend>
      <div className="form-grid">
        <TextField label="Nome" value={attack.name} maxLength={60} onChange={(name) => set({ name })} />
        <div className="field">
          <label htmlFor={abilityId}>Caratteristica</label>
          <select id={abilityId} value={attack.ability} onChange={(e) => set({ ability: e.target.value as Attack['ability'] })}>
            {ABILITIES.map((a) => (
              <option key={a} value={a}>
                {ABILITY_LABELS[a].long}
              </option>
            ))}
            <option value="none">Nessuna</option>
          </select>
        </div>
        <NumberField
          label="Bonus extra al colpire"
          value={attack.bonus}
          min={-SHEET_LIMITS.bonus}
          max={SHEET_LIMITS.bonus}
          onCommit={(bonus) => set({ bonus })}
        />
        <DamageField value={attack.damage} onCommit={(damage) => set({ damage })} />
        <NumberField
          label="Bonus extra ai danni"
          value={attack.damageBonus}
          min={-SHEET_LIMITS.bonus}
          max={SHEET_LIMITS.bonus}
          onCommit={(damageBonus) => set({ damageBonus })}
        />
        <TextField label="Tipo di danno" value={attack.damageType} maxLength={30} placeholder="taglienti" onChange={(damageType) => set({ damageType })} />
      </div>
      <div className="row">
        <label className="inline">
          <input type="checkbox" checked={attack.proficient} onChange={(e) => set({ proficient: e.target.checked })} />
          Competente
        </label>
        <label className="inline">
          <input type="checkbox" checked={attack.addAbilityToDamage} onChange={(e) => set({ addAbilityToDamage: e.target.checked })} />
          Aggiungi il modificatore ai danni
        </label>
      </div>
      <TextField label="Note" value={attack.notes} maxLength={200} placeholder="Versatile (1d10), gittata 6/18 m…" onChange={(notes) => set({ notes })} />
      <div>
        <button
          type="button"
          className="danger"
          onClick={() => editSheet((x) => ({ ...x, attacks: x.attacks.filter((a) => a.id !== attack.id) }))}
        >
          Elimina «{attack.name}»
        </button>
      </div>
    </fieldset>
  );
}

export function AttacksCard({ editing }: { editing: boolean }) {
  const s = useSheet();

  return (
    <section className="card stack" aria-labelledby="attacks-title">
      <h2 id="attacks-title">Attacchi</h2>
      {s.attacks.length === 0 && !editing && (
        <p className="muted">Nessun attacco: premi «Modifica la scheda» per aggiungere le tue armi e i trucchetti.</p>
      )}
      <ul className="list">
        {s.attacks.map((a) =>
          editing ? (
            <li key={a.id}>
              <AttackEditor attack={a} />
            </li>
          ) : (
            <li key={a.id} className="attack">
              <div className="attack-name">
                <strong>{a.name}</strong>
                {a.notes && <span className="small muted">{a.notes}</span>}
              </div>
              <div className="row">
                <button
                  type="button"
                  className="roll-btn"
                  aria-label={`${a.name}: tiro per colpire, ${formatSigned(attackBonus(s, a))}`}
                  onClick={() => rollFrom(attackFormula(s, a), `${a.name}: attacco`)}
                >
                  {formatSigned(attackBonus(s, a))}
                </button>
                {damageFormula(s, a) !== null && (
                  <>
                    <button
                      type="button"
                      className="damage-btn"
                      aria-label={`${a.name}: danni, ${damageFormula(s, a)}`}
                      onClick={() => rollFrom(damageFormula(s, a)!, `${a.name}: danni`)}
                    >
                      {damageFormula(s, a)} <span className="muted">{a.damageType}</span>
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      aria-label={`${a.name}: danni critici, ${damageFormula(s, a, true)}`}
                      onClick={() => rollFrom(damageFormula(s, a, true)!, `${a.name}: danni critici`)}
                    >
                      Critico
                    </button>
                  </>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
      {editing && s.attacks.length < SHEET_LIMITS.attacks && (
        <div>
          <button type="button" onClick={() => editSheet((x) => ({ ...x, attacks: [...x.attacks, newAttack()] }))}>
            Aggiungi un attacco
          </button>
        </div>
      )}
    </section>
  );
}
