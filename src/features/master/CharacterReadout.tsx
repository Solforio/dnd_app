import { useEffect } from 'react';
import { ensureSpellCatalogue, useSpellCatalogue } from '../../data/spellCatalogue';
import type { Character } from '../../domain/character';
import { formatNumber, formatSigned } from '../../domain/format/number';
import { carriedWeightLb, COIN_LABELS, COINS, formatGp, formatWeight, totalValueCp } from '../../domain/inventory';
import { ABILITIES, ABILITY_LABELS, CONDITION_LABELS, SKILL_INFO, SKILLS } from '../../domain/sheet/rules';
import {
  abilityMod,
  attackBonus,
  classSummary,
  damageFormula,
  initiative,
  passivePerception,
  saveBonus,
  sheetProficiency,
  skillBonus,
  totalLevel,
} from '../../domain/sheet/sheet';
import { pactLeft, slotRows } from '../../domain/sheet/spellSlots';
import { listOf, spellClassOf } from '../../domain/spells';

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="readout-part">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/**
 * A character, read-only, for the Master: the numbers that matter at the table first, then the sheet
 * and the backpack. It shows what the player shared; nothing here can be edited.
 */
export function CharacterReadout({ character }: { character: Character }) {
  const { sheet: s, inventory: inv, hp } = character;
  const byId = useSpellCatalogue((x) => x.byId);
  useEffect(() => ensureSpellCatalogue(), []);

  const proficient = SKILLS.filter((k) => s.skills[k].prof > 0 || s.skills[k].bonus !== 0);
  const casters = s.classes.flatMap((c) => {
    const sc = spellClassOf(c);
    return sc ? [{ c, sc }] : [];
  });
  const rows = slotRows(s);
  const pact = pactLeft(s);
  const name = (id: string) => byId.get(id)?.name ?? id;

  return (
    <div className="readout stack">
      <p className="small muted">
        {[s.race, classSummary(s.classes), s.background, s.alignment].filter(Boolean).join(' · ')} · livello {totalLevel(s.classes)}
      </p>

      <div className="stats">
        <div className="stat">
          <span className="label">PF</span>
          <span className="stat-value">
            {formatNumber(hp.cur)}/{formatNumber(hp.max)}
            {hp.temp > 0 && <span className="muted small"> +{formatNumber(hp.temp)}</span>}
          </span>
        </div>
        <div className="stat">
          <span className="label">CA</span>
          <span className="stat-value">{formatNumber(s.ac)}</span>
        </div>
        <div className="stat">
          <span className="label">Iniziativa</span>
          <span className="stat-value">{formatSigned(initiative(s))}</span>
        </div>
        <div className="stat">
          <span className="label">Velocità</span>
          <span className="stat-value">{formatNumber(s.speedM, 1)} m</span>
        </div>
        <div className="stat">
          <span className="label">Competenza</span>
          <span className="stat-value">{formatSigned(sheetProficiency(s))}</span>
        </div>
        <div className="stat">
          <span className="label">Perc. passiva</span>
          <span className="stat-value">{formatNumber(passivePerception(s))}</span>
        </div>
      </div>

      {(s.conditions.length > 0 || s.exhaustion > 0 || s.inspiration || hp.cur === 0) && (
        <p>
          {hp.cur === 0 && (
            <span className="result-tag fumble">
              A terra: salvezze {character.deathSaves.successes} successi, {character.deathSaves.failures} fallimenti
            </span>
          )}{' '}
          {s.conditions.map((c) => (
            <span key={c} className="chip on static">
              {CONDITION_LABELS[c]}
            </span>
          ))}{' '}
          {s.exhaustion > 0 && <span className="chip on static">Indebolimento {s.exhaustion}</span>}{' '}
          {s.inspiration && <span className="result-tag crit">Ispirazione</span>}
        </p>
      )}

      <Part title="Caratteristiche e salvezze">
        <div className="block-abilities" role="table" aria-label="Caratteristiche">
          {ABILITIES.map((a) => (
            <div key={a} role="row">
              <span className="label" role="columnheader">
                {ABILITY_LABELS[a].short}
              </span>
              <span role="cell">
                {s.abilities[a]} <span className="muted">({formatSigned(abilityMod(s.abilities[a]))})</span>
              </span>
              <span className="small muted" role="cell">
                salv. {formatSigned(saveBonus(s, a))}
                {s.saves[a].proficient ? ' ●' : ''}
              </span>
            </div>
          ))}
        </div>
      </Part>

      {proficient.length > 0 && (
        <Part title="Abilità competenti">
          <p className="small">{proficient.map((k) => `${SKILL_INFO[k].label} ${formatSigned(skillBonus(s, k))}`).join(' · ')}</p>
        </Part>
      )}

      {s.attacks.length > 0 && (
        <Part title="Attacchi">
          <ul className="plain stack-tight">
            {s.attacks.map((a) => (
              <li key={a.id} className="small">
                <strong>{a.name}</strong> {formatSigned(attackBonus(s, a))} per colpire
                {damageFormula(s, a) ? `, danni ${damageFormula(s, a)}` : ''}
                {a.damageType ? ` ${a.damageType}` : ''}
              </li>
            ))}
          </ul>
        </Part>
      )}

      {s.features.length > 0 && (
        <Part title="Capacità e tratti">
          <ul className="plain stack-tight">
            {s.features.map((f) => (
              <li key={f.id} className="small">
                <strong>{f.name}</strong>
                {f.uses && (
                  <span className="muted">
                    {' '}
                    {f.uses.cur}/{f.uses.max} ({f.uses.reset === 'short' ? 'riposo breve' : 'riposo lungo'})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Part>
      )}

      {casters.length > 0 && (
        <Part title="Incantesimi">
          <p className="small">
            {rows.length === 0 && !pact
              ? 'Nessuno slot.'
              : [
                  ...rows.map((r) => `${r.level}° ${r.left}/${r.max}`),
                  ...(pact ? [`Patto ${pact.left}/${pact.pact.count} (${pact.pact.level}°)`] : []),
                ].join(' · ')}
          </p>
          {casters.map(({ c, sc }) => {
            const l = listOf(s, sc.key);
            return (
              <p key={sc.key} className="small">
                <strong>{sc.label} {c.level}</strong>: {[...l.known, ...l.prepared].map(name).join(', ') || 'nessun incantesimo scelto'}
              </p>
            );
          })}
        </Part>
      )}

      <Part title="Zaino">
        <p className="small">
          {COINS.filter((k) => inv.coins[k] > 0)
            .map((k) => `${formatNumber(inv.coins[k])} ${COIN_LABELS[k].short}`)
            .join(' · ') || 'Nessuna moneta'}
          {' · '}
          peso {formatWeight(carriedWeightLb(inv), inv.settings.weightUnit)} · valore {formatGp(totalValueCp(inv))} mo
        </p>
        {inv.items.length === 0 ? (
          <p className="small muted">Nessun oggetto.</p>
        ) : (
          <ul className="plain stack-tight">
            {inv.items.map((i) => (
              <li key={i.id} className="small">
                {i.quantity > 1 ? `${i.quantity} × ` : ''}
                {i.name}
                {i.equipped ? ' (equipaggiato)' : ''}
                {i.attuned ? ' (sintonizzato)' : ''}
              </li>
            ))}
          </ul>
        )}
      </Part>
    </div>
  );
}
