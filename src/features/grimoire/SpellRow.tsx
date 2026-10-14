import { useState, type ReactNode } from 'react';
import { useSpellDialog } from '../../data/spellDialog';
import { newId } from '../../domain/character';
import { castOptions, castWithEffect, type CastChoice, type Spell } from '../../domain/spells';
import { editSheet, useSheet } from '../sheet/sheetHooks';
import { excerpt, levelLabel } from './labels';

/** Name (opens the full text), level, tags and the start of the description. */
export function SpellSummary({ spell }: { spell: Spell }) {
  const open = useSpellDialog((s) => s.open);
  return (
    <div className="spell-summary">
      <div className="spell-title">
        <button type="button" className="link spell-name" onClick={() => open(spell)}>
          {spell.name}
        </button>
        <span className="small muted">
          {levelLabel(spell.level)} · {spell.school}
        </span>
        {spell.concentration && (
          <span className="result-tag" title="Concentrazione">
            C
          </span>
        )}
        {spell.ritual && (
          <span className="result-tag" title="Rituale">
            R
          </span>
        )}
      </div>
      <p className="small spell-excerpt">{excerpt(spell.text)}</p>
    </div>
  );
}

/** The «Leggi» button that opens the full description. */
export function ReadButton({ spell }: { spell: Spell }) {
  const open = useSpellDialog((s) => s.open);
  return (
    <button type="button" className="ghost" aria-label={`Leggi ${spell.name}`} onClick={() => open(spell)}>
      Leggi
    </button>
  );
}

function describe(o: CastChoice): string {
  if (o.kind === 'slot') return `Slot di ${o.level}° livello (${o.left} rimasti)`;
  if (o.kind === 'pact') return `Slot del Patto, ${o.level}° livello (${o.left} rimasti)`;
  return 'Come rituale (nessuno slot)';
}

/** A spell in a list: summary, «Leggi», «Lancia» (spends a slot, then offers the description), plus what the list adds. */
export function SpellRow({ spell, canCast, children }: { spell: Spell; canCast: boolean; children?: ReactNode }) {
  const s = useSheet();
  const announce = useSpellDialog((x) => x.announceCast);
  const [open, setOpen] = useState(false);
  const options = canCast ? castOptions(s, spell) : [];
  const cast = (o: CastChoice) => {
    const r = castWithEffect(s, o, spell, newId);
    editSheet(() => r.sheet);
    setOpen(false);
    const how =
      o.kind === 'ritual'
        ? 'come rituale'
        : o.kind === 'free'
          ? ''
          : `con uno slot di ${o.level}° livello${o.kind === 'pact' ? ' del Patto' : ''}`;
    const effect = r.tracked ? ' Aggiunto agli effetti attivi.' : '';
    const dropped = r.dropped ? ` Concentrazione su ${r.dropped} interrotta.` : '';
    announce(spell, `${spell.name} lanciato${how ? ` ${how}` : ''}.${effect}${dropped}`);
  };

  return (
    <li className="spell-row">
      <SpellSummary spell={spell} />
      <div className="row spell-actions">
        <ReadButton spell={spell} />
        {canCast && spell.level === 0 && (
          <button type="button" onClick={() => cast({ kind: 'free' })}>
            Lancia
          </button>
        )}
        {canCast && spell.level > 0 && (
          <button
            type="button"
            disabled={options.length === 0}
            title={options.length === 0 ? 'Nessuno slot disponibile' : undefined}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            Lancia
          </button>
        )}
        {children}
      </div>
      {open && (
        <div className="row cast-menu" role="group" aria-label={`Come lanciare ${spell.name}`}>
          {options.map((o, i) => (
            <button key={i} type="button" onClick={() => cast(o)}>
              {describe(o)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
