import { useState } from 'react';
import { useSpellCatalogue } from '../../data/spellCatalogue';
import { formatNumber } from '../../domain/format/number';
import { pactLeft, slotRows } from '../../domain/sheet/spellSlots';
import { castable, spellClassOf, type Spell } from '../../domain/spells';
import { SpellRow } from '../grimoire/SpellRow';
import { levelLabel } from '../grimoire/labels';
import { useSheet } from '../sheet/sheetHooks';

/**
 * The spells that can be cast right now (cantrips, known or prepared), grouped by level, each readable in full
 * and castable with a slot. Learning and preparing spells is done in the Grimorio tab.
 */
export function CombatSpells() {
  const s = useSheet();
  const { byId, status } = useSpellCatalogue();
  const [message, setMessage] = useState('');
  const casters = s.classes.flatMap((c) => {
    const sc = spellClassOf(c);
    return sc ? [sc] : [];
  });
  if (casters.length === 0) return null;

  const ids = [...new Set(casters.flatMap((sc) => castable(s, sc, byId)))];
  const spells = ids.flatMap((id) => byId.get(id) ?? []).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const levels = [...new Set(spells.map((sp) => sp.level))];
  const rows = slotRows(s);
  const pact = pactLeft(s);

  return (
    <section className="card stack" aria-labelledby="combat-spells-title">
      <h2 id="combat-spells-title">Incantesimi pronti</h2>
      <p className="small">
        {rows.length === 0 && !pact
          ? 'Nessuno slot.'
          : [
              ...rows.map((r) => `${r.level}° ${formatNumber(r.left)}/${formatNumber(r.max)}`),
              ...(pact ? [`Patto ${formatNumber(pact.left)}/${formatNumber(pact.pact.count)}`] : []),
            ].join(' · ')}
      </p>
      {status === 'loading' && <p className="small muted">Carico l’elenco degli incantesimi…</p>}
      {status === 'error' && (
        <p className="small red" role="alert">
          Non riesco a caricare l’elenco degli incantesimi: controlla la connessione.
        </p>
      )}
      {status === 'ready' && spells.length === 0 && (
        <p className="small muted">Nessun incantesimo pronto: sceglili e preparali nella scheda Grimorio.</p>
      )}
      {levels.map((level) => (
        <div key={level} className="stack-tight">
          <h3>{levelLabel(level)}</h3>
          <ul className="plain spell-list">
            {spells
              .filter((sp: Spell) => sp.level === level)
              .map((sp) => (
                <SpellRow key={sp.id} spell={sp} canCast onCast={setMessage} />
              ))}
          </ul>
        </div>
      ))}
      <p className="status-line small" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
