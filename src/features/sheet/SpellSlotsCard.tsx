import { NumberField } from '../../components/NumberField';
import { formatNumber } from '../../domain/format/number';
import {
  casterLevel,
  pactLeft,
  recoverPact,
  recoverSlot,
  setManualMax,
  setManualSlots,
  SLOT_LEVELS,
  slotRows,
  spendPact,
  spendSlot,
  SPELLCASTING_LIMITS,
} from '../../domain/sheet/spellSlots';
import { editSheet, useSheet } from './sheetHooks';

/** One round button per slot: filled = available (click to spend it), empty = spent (click to get it back). */
function Pips({ label, max, left, onSpend, onRecover }: { label: string; max: number; left: number; onSpend: () => void; onRecover: () => void }) {
  return (
    <div className="slot-pips" role="group" aria-label={`${label}: ${left} su ${max} disponibili`}>
      {Array.from({ length: max }, (_, i) => {
        const available = i < left;
        return (
          <button
            key={i}
            type="button"
            className={`slot-pip${available ? ' on' : ''}`}
            aria-label={available ? `Usa uno slot, ${label}` : `Recupera uno slot, ${label}`}
            onClick={available ? onSpend : onRecover}
          />
        );
      })}
    </div>
  );
}

/**
 * Spell slots: the maximum comes from the class levels (or is set by hand),
 * slots are spent in play, a long rest restores them all, a short rest the
 * warlock's pact slots.
 */
export function SpellSlotsCard({ editing, alwaysShow = false }: { editing: boolean; alwaysShow?: boolean }) {
  const s = useSheet();
  const rows = slotRows(s);
  const pact = pactLeft(s);
  const manual = s.spellcasting.manualMax !== null;
  if (rows.length === 0 && !pact && !editing && !alwaysShow) return null;

  return (
    <section className="card stack" aria-labelledby="slots-title">
      <h2 id="slots-title">Slot incantesimo</h2>
      {rows.length === 0 && !pact && (
        <p className="small muted">
          Nessuna classe incantatrice riconosciuta (mago, stregone, chierico, druido, bardo, paladino, ranger, warlock, Cavaliere Mistico,
          Mistificatore Arcano). Puoi impostare gli slot a mano qui sotto.
        </p>
      )}
      <ul className="plain stack">
        {rows.map((r) => (
          <li key={r.level} className="row slot-row">
            <span className="slot-label">{r.level}° livello</span>
            <Pips
              label={`${r.level}° livello`}
              max={r.max}
              left={r.left}
              onSpend={() => editSheet((x) => spendSlot(x, r.level))}
              onRecover={() => editSheet((x) => recoverSlot(x, r.level))}
            />
            <span className="small muted">
              {formatNumber(r.left)}/{formatNumber(r.max)}
            </span>
          </li>
        ))}
        {pact && (
          <li className="row slot-row">
            <span className="slot-label">Patto ({pact.pact.level}° livello)</span>
            <Pips
              label={`Magia del Patto, ${pact.pact.level}° livello`}
              max={pact.pact.count}
              left={pact.left}
              onSpend={() => editSheet(spendPact)}
              onRecover={() => editSheet(recoverPact)}
            />
            <span className="small muted">
              {formatNumber(pact.left)}/{formatNumber(pact.pact.count)} · riposo breve o lungo
            </span>
          </li>
        )}
      </ul>
      <p className="small muted">
        Tocca un cerchio pieno per usare lo slot, uno vuoto per recuperarlo (per esempio con il Recupero Arcano). Il riposo lungo li
        recupera tutti
        {pact ? '; il riposo breve recupera gli slot del Patto' : ''}.
        {!manual && rows.length > 0 && ` Calcolati dai livelli di classe (livello da incantatore ${formatNumber(casterLevel(s.classes))}).`}
      </p>

      {editing && (
        <div className="stack">
          <label className="inline">
            <input type="checkbox" checked={manual} onChange={(e) => editSheet((x) => setManualSlots(x, e.target.checked))} />
            Imposto io il numero di slot (oggetti magici, regole della casa)
          </label>
          {manual && (
            <div className="row">
              {Array.from({ length: SLOT_LEVELS }, (_, i) => (
                <NumberField
                  key={i}
                  label={`${i + 1}° livello`}
                  value={s.spellcasting.manualMax?.[i] ?? 0}
                  min={0}
                  max={SPELLCASTING_LIMITS.slots}
                  onCommit={(n) => editSheet((x) => setManualMax(x, i + 1, n))}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
