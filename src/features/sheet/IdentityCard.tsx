import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { NumberField } from '../../components/NumberField';
import { TextField } from '../../components/TextField';
import { useCharacterStore } from '../../data/characterStore';
import { d20Formula, initiative, passivePerception, sheetProficiency, SHEET_LIMITS, totalLevel } from '../../domain/sheet/sheet';
import { hitDieOf, HIT_DIE_OPTIONS } from '../../domain/sheet/hitDice';
import { LEVEL_MAX } from '../../domain/sheet/rules';
import { capacityLb, carriedWeightLb, encumbrance, speedPenaltyM } from '../../domain/inventory';
import { formatNumber, formatSigned } from '../../domain/format/number';
import { CharacterAvatar } from '../portrait/Avatar';
import { LevelUpSection } from './LevelUp';
import { PictureControls } from '../portrait/PictureControls';
import { editSheet, rollFrom, useSheet } from './sheetHooks';
import { usePortraitStore } from '../../data/portraitStore';

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className="stat-value">{children}</span>
    </div>
  );
}

/** Name, race, classes and the headline numbers (proficiency, AC, initiative, speed, passive Perception). */
export function IdentityCard({ editing, onToggleEdit }: { editing: boolean; onToggleEdit: () => void }) {
  const name = useCharacterStore((s) => s.character.name);
  const hp = useCharacterStore((s) => s.character.hp);
  const rename = useCharacterStore((s) => s.rename);
  const characterId = useCharacterStore((s) => s.character.id);
  const [levelNote, setLevelNote] = useState('');
  const hasPortrait = usePortraitStore((s) => !!s.byId[characterId]?.portrait);
  const s = useSheet();
  const init = initiative(s);
  const inventory = useCharacterStore((x) => x.character.inventory);
  const penalty = speedPenaltyM(
    encumbrance(carriedWeightLb(inventory), capacityLb(s.abilities.str, inventory.settings), inventory.settings.variantEncumbrance),
    inventory.settings.variantEncumbrance,
  );

  const subtitle = [
    s.race,
    s.classes
      .filter((c) => c.name.trim())
      .map((c) => `${c.name.trim()}${c.subclass.trim() ? ` (${c.subclass.trim()})` : ''} ${c.level}`)
      .join(' / ') || `Livello ${formatNumber(totalLevel(s.classes))}`,
    s.background,
    s.alignment,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="card stack span-all" aria-labelledby="sheet-name">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="identity-head">
          <CharacterAvatar characterId={characterId} name={name} size={64} />
          <div>
            <h2 id="sheet-name" style={{ margin: 0 }}>
              {name || 'Senza nome'}
            </h2>
            <p className="small muted">{subtitle}</p>
          </div>
        </div>
        <button type="button" className={editing ? 'primary' : undefined} aria-pressed={editing} onClick={onToggleEdit}>
          {editing ? 'Fine modifiche' : 'Modifica la scheda'}
        </button>
      </div>

      {editing && (
        <div className="stack">
          <div className="form-grid">
            <TextField label="Nome" value={name} maxLength={80} onChange={rename} />
            <TextField label="Razza" value={s.race} maxLength={60} onChange={(race) => editSheet((x) => ({ ...x, race }))} />
            <TextField
              label="Background"
              value={s.background}
              maxLength={60}
              onChange={(background) => editSheet((x) => ({ ...x, background }))}
            />
            <TextField
              label="Allineamento"
              value={s.alignment}
              maxLength={40}
              onChange={(alignment) => editSheet((x) => ({ ...x, alignment }))}
            />
          </div>
          <p className="small muted">Cambiare il livello qui non modifica i PF. Per salire di livello e guadagnare PF usa «Sali di livello».</p>
          {levelNote && (
            <p className="small" role="status">
              {levelNote}
            </p>
          )}
          <LevelUpSection />
          <PictureControls characterId={characterId} kind="portrait" hasPicture={hasPortrait} />
          <fieldset className="plain stack">
            <legend className="label">Classi</legend>
            {s.classes.map((c, i) => {
              const setClass = (patch: Partial<typeof c>) =>
                editSheet((x) => ({ ...x, classes: x.classes.map((k, j) => (j === i ? { ...k, ...patch } : k)) }));
              return (
                <div className="row class-row" key={i}>
                  <TextField label="Classe" value={c.name} maxLength={40} onChange={(name) => setClass({ name })} />
                  <TextField label="Sottoclasse" value={c.subclass} maxLength={60} onChange={(subclass) => setClass({ subclass })} />
                  <NumberField label="Livello" value={c.level} min={1} max={LEVEL_MAX} onCommit={(level) => {
                      setClass({ level });
                      setLevelNote(
                        level > c.level
                          ? 'Livello alzato, ma i PF massimi non sono cambiati: usa «Sali di livello» qui sotto per aggiungerli.'
                          : '',
                      );
                    }}
                  />
                  <div className="field">
                    <label htmlFor={`hitdie-${i}`}>Dado vita</label>
                    <select
                      id={`hitdie-${i}`}
                      value={c.hitDie}
                      onChange={(e) => setClass({ hitDie: Number(e.target.value) })}
                    >
                      <option value={0}>Auto (d{hitDieOf(c)})</option>
                      {HIT_DIE_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          d{d}
                        </option>
                      ))}
                    </select>
                  </div>
                  {s.classes.length > 1 && (
                    <button
                      type="button"
                      className="ghost"
                      aria-label={`Togli la classe ${c.name || i + 1}`}
                      onClick={() => editSheet((x) => ({ ...x, classes: x.classes.filter((_, j) => j !== i) }))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            {s.classes.length < SHEET_LIMITS.classes && (
              <div>
                <button
                  type="button"
                  onClick={() => editSheet((x) => ({ ...x, classes: [...x.classes, { name: '', subclass: '', level: 1, hitDie: 0, hitDiceUsed: 0 }] }))}
                >
                  Aggiungi una classe (multiclasse)
                </button>
              </div>
            )}
          </fieldset>
        </div>
      )}

      <div className="stats">
        <Stat label="Bonus competenza">{formatSigned(sheetProficiency(s))}</Stat>
        {editing ? (
          <>
            <NumberField label="CA" value={s.ac} min={0} max={SHEET_LIMITS.ac} onCommit={(ac) => editSheet((x) => ({ ...x, ac }))} />
            <NumberField
              label="Bonus iniziativa"
              value={s.initiativeBonus}
              min={-SHEET_LIMITS.bonus}
              max={SHEET_LIMITS.bonus}
              onCommit={(initiativeBonus) => editSheet((x) => ({ ...x, initiativeBonus }))}
            />
            <NumberField
              label="Velocità (m)"
              value={s.speedM}
              min={0}
              max={SHEET_LIMITS.metres}
              decimals={1}
              onCommit={(speedM) => editSheet((x) => ({ ...x, speedM }))}
            />
          </>
        ) : (
          <>
            <Stat label="CA">{formatNumber(s.ac)}</Stat>
            <div className="stat">
              <span className="label">Iniziativa</span>
              <button
                type="button"
                className="roll-btn"
                aria-label={`Tira l’iniziativa, ${formatSigned(init)}`}
                onClick={() => rollFrom(d20Formula(init), 'Iniziativa')}
              >
                {formatSigned(init)}
              </button>
            </div>
            <Stat label="Velocità">
              {penalty > 0 ? (
                <span>
                  {formatNumber(Math.max(0, s.speedM - penalty), 1)} m{' '}
                  <span className="small red">(−{formatNumber(penalty)} ingombro)</span>
                </span>
              ) : (
                <>{formatNumber(s.speedM, 1)} m</>
              )}
            </Stat>
          </>
        )}
        <Stat label="Percezione passiva">{formatNumber(passivePerception(s))}</Stat>
        <div className="stat">
          <span className="label">PF</span>
          <Link to="/" className="stat-value stat-link" aria-label={`PF ${hp.cur} su ${hp.max}: gestiscili nella sezione Tiri`}>
            {formatNumber(hp.cur)}/{formatNumber(hp.max)}
            {hp.temp > 0 && <span className="muted small"> +{formatNumber(hp.temp)}</span>}
          </Link>
        </div>
        <div className="stat">
          <span className="label">Ispirazione</span>
          <button
            type="button"
            className={`toggle${s.inspiration ? ' on' : ''}`}
            aria-pressed={s.inspiration}
            onClick={() => editSheet((x) => ({ ...x, inspiration: !x.inspiration }))}
          >
            {s.inspiration ? 'Sì' : 'No'}
          </button>
        </div>
      </div>
    </section>
  );
}
