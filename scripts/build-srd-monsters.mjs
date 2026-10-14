// Builds public/srd/monsters.json from the SRD 5.1 monster list of the 5e-bits database
// (https://github.com/5e-bits/5e-database, src/2014/en/5e-SRD-Monsters.json; code MIT, text from the SRD 5.1,
// Creative Commons Attribution 4.0). Usage: node scripts/build-srd-monsters.mjs <path to 5e-SRD-Monsters.json>
import { readFileSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('Pass the path of 5e-SRD-Monsters.json');
const raw = JSON.parse(readFileSync(input, 'utf8'));

const label = (key) => key.replace(/_/g, ' ');

/** «(3/Day)», «(Recharge 5-6)»… the way a stat block writes a limited use. */
function usage(u) {
  if (!u) return '';
  if (u.type === 'per day') return ` (${u.times}/Day)`;
  if (u.type === 'recharge on roll') return ` (Recharge ${u.min_value === 6 ? '6' : `${u.min_value}-6`})`;
  if (u.type === 'recharge after rest') return ' (Recharges after a Short or Long Rest)';
  if (u.type === 'at will') return ' (At Will)';
  return '';
}

const entries = (list) => (list ?? []).map((a) => ({ name: `${a.name}${usage(a.usage)}`, text: a.desc }));
const prof = (list, prefix) =>
  list
    .filter((p) => p.proficiency.index.startsWith(prefix))
    .map((p) => `${p.proficiency.name.replace(/^(Saving Throw|Skill): /, '')} ${p.value >= 0 ? '+' : ''}${p.value}`)
    .join(', ');

const monsters = raw
  .map((m) => {
    const ac = m.armor_class?.[0];
    const senses = Object.entries(m.senses ?? {})
      .map(([k, v]) => (k === 'passive_perception' ? `passive Perception ${v}` : `${label(k)} ${v}`))
      .join(', ');
    const out = {
      id: m.index,
      name: m.name,
      size: m.size,
      type: m.type,
      alignment: m.alignment,
      ac: ac?.value ?? 10,
      hp: m.hit_points,
      hpRoll: m.hit_points_roll ?? m.hit_dice,
      speed: Object.entries(m.speed ?? {})
        .map(([k, v]) => (k === 'walk' ? v : `${label(k)} ${v}`))
        .join(', '),
      abilities: [m.strength, m.dexterity, m.constitution, m.intelligence, m.wisdom, m.charisma],
      cr: m.challenge_rating,
      xp: m.xp,
      senses,
      languages: m.languages ?? '',
      traits: entries(m.special_abilities),
      actions: entries(m.actions),
    };
    if (m.subtype) out.subtype = m.subtype;
    if (ac?.type && ac.type !== 'dex') out.acNote = ac.type;
    const saves = prof(m.proficiencies ?? [], 'saving-throw');
    if (saves) out.saves = saves;
    const skills = prof(m.proficiencies ?? [], 'skill');
    if (skills) out.skills = skills;
    if (m.damage_vulnerabilities?.length) out.vulnerabilities = m.damage_vulnerabilities.join(', ');
    if (m.damage_resistances?.length) out.resistances = m.damage_resistances.join(', ');
    if (m.damage_immunities?.length) out.immunities = m.damage_immunities.join(', ');
    if (m.condition_immunities?.length) out.conditionImmunities = m.condition_immunities.map((c) => c.name).join(', ');
    if (m.reactions?.length) out.reactions = entries(m.reactions);
    if (m.legendary_actions?.length) out.legendary = entries(m.legendary_actions);
    return out;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(new URL('../public/srd/monsters.json', import.meta.url), JSON.stringify({ source: 'SRD 5.1 (CC BY 4.0)', monsters }));
console.log(`${monsters.length} monsters written`);
