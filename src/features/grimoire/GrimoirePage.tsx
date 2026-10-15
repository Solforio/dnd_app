import { Hint } from '../../components/Hint';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
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
      <SpellSlotsCard editing={editing} alwaysShow={casters.length > 0} />
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
      {casters.length === 0 && !editing && (
        <section className="card stack">
          <h2>Nessuna classe incantatrice</h2>
          <p className="small muted">Scrivi una classe come Mago, Chierico o Warlock nella scheda per avere slot e incantesimi qui.</p>
          <div>
            <Link className="button-link" to="/scheda">
              Vai alla scheda
            </Link>
          </div>
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
