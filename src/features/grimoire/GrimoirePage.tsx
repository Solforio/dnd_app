import { Hint } from '../../components/Hint';
import { useEffect, useState } from 'react';
import { ensureSpellCatalogue } from '../../data/spellCatalogue';
import { spellClassOf } from '../../domain/spells';
import { editSheet, useSheet } from '../sheet/sheetHooks';
import { SpellSlotsCard } from '../sheet/SpellSlotsCard';
import { ClassSpellsCard } from './ClassSpellsCard';

/** The grimoire: spell slots, then the spells of each casting class of the character. */
export function GrimoirePage() {
  const [editing, setEditing] = useState(false);
  const sheet = useSheet();
  const casters = sheet.classes.filter((c) => spellClassOf(c) !== null);
  useEffect(() => ensureSpellCatalogue(), []);

  return (
    <main className="app-main single">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Grimorio</h2>
        <button type="button" className={editing ? 'primary' : undefined} aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Fine modifiche' : 'Modifica'}
        </button>
      </div>
      <SpellSlotsCard editing={editing} alwaysShow />
      {editing && (
        <label className="inline">
          <input
            type="checkbox"
            checked={sheet.spellcasting.ignoreLimits}
            onChange={(e) => editSheet((x) => ({ ...x, spellcasting: { ...x.spellcasting, ignoreLimits: e.target.checked } }))}
          />
          Ignora i limiti di incantesimi (talenti, oggetti magici, regole della casa)
        </label>
      )}
      {casters.length === 0 && (
        <section className="card stack">
          <p>
            Nessuna classe incantatrice riconosciuta: scrivi la classe nella Scheda («Modifica la scheda»), per esempio Mago, Chierico
            o Warlock.
          </p>
        </section>
      )}
      {casters.map((c, i) => (
        <ClassSpellsCard key={`${c.name}-${i}`} c={c} editing={editing} />
      ))}
      <Hint short="Incantesimi dell’SRD 5.1, in inglese.">
        Gli incantesimi vengono dal System Reference Document 5.1 (CC-BY 4.0) e sono in inglese: sono solo quelli dell’SRD, non tutti
        quelli dei manuali.
      </Hint>
    </main>
  );
}
