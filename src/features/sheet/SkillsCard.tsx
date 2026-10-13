import { useId } from 'react';
import { NumberField } from '../../components/NumberField';
import { formatSigned } from '../../domain/format/number';
import { ABILITY_LABELS, SKILL_INFO, SKILLS, type SkillId } from '../../domain/sheet/rules';
import { d20Formula, SHEET_LIMITS, skillBonus, type Proficiency } from '../../domain/sheet/sheet';
import { editSheet, rollFrom, useSheet } from './sheetHooks';

const PROF_LABEL: Record<string, string> = {
  '0': 'Nessuna',
  '0.5': 'Mezza competenza',
  '1': 'Competente',
  '2': 'Maestria',
};
const PROF_CLASS: Record<string, string> = { '0': 'p0', '0.5': 'ph', '1': 'p1', '2': 'p2' };

const bySkillLabel = [...SKILLS].sort((a, b) => SKILL_INFO[a].label.localeCompare(SKILL_INFO[b].label, 'it'));

function SkillEdit({ skill }: { skill: SkillId }) {
  const s = useSheet();
  const id = useId();
  const { label } = SKILL_INFO[skill];
  const entry = s.skills[skill];
  const setSkill = (patch: Partial<typeof entry>) =>
    editSheet((x) => ({ ...x, skills: { ...x.skills, [skill]: { ...x.skills[skill], ...patch } } }));
  return (
    <>
      <label htmlFor={id} className="skill-name">
        {label}
      </label>
      <select id={id} value={String(entry.prof)} onChange={(e) => setSkill({ prof: Number(e.target.value) as Proficiency })}>
        {Object.entries(PROF_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <NumberField
        label={`Bonus extra a ${label}`}
        hideLabel
        value={entry.bonus}
        min={-SHEET_LIMITS.bonus}
        max={SHEET_LIMITS.bonus}
        onCommit={(bonus) => setSkill({ bonus })}
      />
      <span className="check-total">{formatSigned(skillBonus(s, skill))}</span>
    </>
  );
}

export function SkillsCard({ editing }: { editing: boolean }) {
  const s = useSheet();

  return (
    <section className="card stack" aria-labelledby="skills-title">
      <h2 id="skills-title">Abilità</h2>
      <ul className="list compact">
        {bySkillLabel.map((skill) => {
          const { label, ability } = SKILL_INFO[skill];
          const bonus = skillBonus(s, skill);
          const prof = String(s.skills[skill].prof);
          return (
            <li className={`check-row${editing ? ' skill-edit' : ''}`} key={skill}>
              {editing ? (
                <SkillEdit skill={skill} />
              ) : (
                <button
                  type="button"
                  className="check-btn"
                  aria-label={`${label}, ${formatSigned(bonus)}${prof !== '0' ? `, ${PROF_LABEL[prof]!.toLowerCase()}` : ''}`}
                  onClick={() => rollFrom(d20Formula(bonus), label)}
                >
                  <span className={`prof-dot ${PROF_CLASS[prof]}`} aria-hidden="true" />
                  <span>
                    {label} <span className="muted small">{ABILITY_LABELS[ability].short}</span>
                  </span>
                  <span className="check-total">{formatSigned(bonus)}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {!editing && (
        <p className="small muted">
          <span className="prof-dot ph" aria-hidden="true" /> mezza competenza · <span className="prof-dot p1" aria-hidden="true" /> competente ·{' '}
          <span className="prof-dot p2" aria-hidden="true" /> maestria
        </p>
      )}
    </section>
  );
}
