import { useState, type ReactNode } from 'react';
import { newId } from '../../domain/character';
import { castOptions, castWithEffect, type CastChoice, type Spell } from '../../domain/spells';
import { editSheet, useSheet } from '../sheet/sheetHooks';
import { levelLabel } from './labels';

/** Name, tags and the full SRD text of a spell, folded away until opened. */
export function SpellDetails({ spell }: { spell: Spell }) {
  return (
    <details className="spell-details">
      <summary>
        <span className="spell-name">{spell.name}</span>
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
      </summary>
      <dl className="spell-facts small">
        <div>
          <dt>Tempo di lancio</dt>
          <dd>{spell.castingTime}</dd>
        </div>
        <div>
          <dt>Gittata</dt>
          <dd>{spell.range}</dd>
        </div>
        <div>
          <dt>Componenti</dt>
          <dd>
            {spell.components}
            {spell.material ? ` (${spell.material})` : ''}
          </dd>
        </div>
        <div>
          <dt>Durata</dt>
          <dd>{spell.duration}</dd>
        </div>
      </dl>
      {spell.text.split('\n\n').map((p, i) => (
        <p key={i} className="small">
          {p}
        </p>
      ))}
      {spell.higher && <p className="small">{spell.higher}</p>}
    </details>
  );
}

function describe(o: CastChoice): string {
  if (o.kind === 'slot') return `Slot di ${o.level}° livello (${o.left} rimasti)`;
  if (o.kind === 'pact') return `Slot del Patto, ${o.level}° livello (${o.left} rimasti)`;
  return 'Come rituale (nessuno slot)';
}

/** A spell in a list, with its buttons: cast (spends a slot), plus whatever the list adds. */
export function SpellRow({
  spell,
  canCast,
  onCast,
  children,
}: {
  spell: Spell;
  canCast: boolean;
  onCast: (message: string) => void;
  children?: ReactNode;
}) {
  const s = useSheet();
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
    onCast(`${spell.name} lanciato${how ? ` ${how}` : ''}.${effect}${dropped}`);
  };

  return (
    <li className="spell-row">
      <SpellDetails spell={spell} />
      <div className="row spell-actions">
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
