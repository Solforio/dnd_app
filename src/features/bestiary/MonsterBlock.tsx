import type { ReactNode } from 'react';
import { formatNumber, formatSigned } from '../../domain/format/number';
import { formatCr, SIZE_LABELS, typeLabel, type Feature, type Monster, type RevealSection } from '../../domain/bestiary';
import { abilityMod } from '../../domain/sheet/sheet';
import { ABILITIES, ABILITY_LABELS } from '../../domain/sheet/rules';

/** A line of the stat block; unknown when the party has not learned it yet. */
function Line({ label, known, children }: { label: string; known: boolean; children: ReactNode }) {
  return (
    <p className={`block-line${known ? '' : ' unknown'}`}>
      <strong>{label}</strong> {known ? children : <span aria-label="sconosciuto">???</span>}
    </p>
  );
}

function Features({ title, items, known }: { title: string; items: Feature[]; known: boolean }) {
  if (items.length === 0) return null;
  return (
    <section className="block-section">
      <h3>{title}</h3>
      {known ? (
        items.map((f, i) => (
          <p key={i} className="block-feature">
            <strong>{f.name}.</strong> {f.text}
          </p>
        ))
      ) : (
        <p className="block-line unknown">
          ??? <span className="small muted">Ancora sconosciute.</span>
        </p>
      )}
    </section>
  );
}

/**
 * The stat block of a monster. With `revealed`, only the sections the party has learned are shown and the
 * rest is «???» (the Pokédex idea); without it everything is shown. The text is the SRD's, in English.
 */
export function MonsterBlock({ monster, revealed }: { monster: Monster; revealed?: readonly RevealSection[] }) {
  const has = (s: RevealSection) => revealed === undefined || revealed.includes(s);
  const defenses = [
    monster.vulnerabilities && ['Vulnerabilità', monster.vulnerabilities],
    monster.resistances && ['Resistenze', monster.resistances],
    monster.immunities && ['Immunità ai danni', monster.immunities],
    monster.conditionImmunities && ['Immunità alle condizioni', monster.conditionImmunities],
  ].filter((x): x is [string, string] => Boolean(x));

  return (
    <div className="monster-block stack">
      <p className="small muted">
        {SIZE_LABELS[monster.size] ?? monster.size} · {typeLabel(monster.type)}
        {monster.subtype ? ` (${monster.subtype})` : ''} · {monster.alignment}
      </p>
      <Line label="Classe armatura" known={has('ac')}>
        {formatNumber(monster.ac)}
        {monster.acNote ? ` (${monster.acNote})` : ''}
      </Line>
      <Line label="Punti ferita" known={has('hp')}>
        {formatNumber(monster.hp)} ({monster.hpRoll})
      </Line>
      <Line label="Velocità" known={has('speed')}>
        {monster.speed}
      </Line>

      {has('abilities') ? (
        <div className="block-abilities" role="table" aria-label="Caratteristiche">
          {ABILITIES.map((a, i) => (
            <div key={a} role="row">
              <span className="label" role="columnheader">
                {ABILITY_LABELS[a].short}
              </span>
              <span role="cell">
                {monster.abilities[i]} <span className="muted">({formatSigned(abilityMod(monster.abilities[i]!))})</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Line label="Caratteristiche" known={false}>
          {null}
        </Line>
      )}

      {(monster.saves || monster.skills) && (
        <>
          {monster.saves && (
            <Line label="Tiri salvezza" known={has('saves')}>
              {monster.saves}
            </Line>
          )}
          {monster.skills && (
            <Line label="Abilità" known={has('saves')}>
              {monster.skills}
            </Line>
          )}
        </>
      )}
      {defenses.map(([label, value]) => (
        <Line key={label} label={label} known={has('defenses')}>
          {value}
        </Line>
      ))}
      <Line label="Sensi" known={has('senses')}>
        {monster.senses}
      </Line>
      <Line label="Linguaggi" known={has('languages')}>
        {monster.languages || '—'}
      </Line>
      <Line label="Grado di sfida" known={has('cr')}>
        {formatCr(monster.cr)} ({formatNumber(monster.xp)} PE)
      </Line>

      <Features title="Tratti" items={monster.traits} known={has('traits')} />
      <Features title="Azioni" items={monster.actions} known={has('actions')} />
      <Features title="Reazioni" items={monster.reactions ?? []} known={has('actions')} />
      <Features title="Azioni leggendarie" items={monster.legendary ?? []} known={has('legendary')} />
    </div>
  );
}
