// Builds public/srd/spells.json from the SRD 5.1 spell list of the 5e-bits database
// (https://github.com/5e-bits/5e-database, src/2014/en/5e-SRD-Spells.json; code MIT, text from the SRD 5.1,
// Creative Commons Attribution 4.0). Usage: node scripts/build-srd-spells.mjs <path to 5e-SRD-Spells.json>
import { readFileSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('Pass the path of 5e-SRD-Spells.json');
const raw = JSON.parse(readFileSync(input, 'utf8'));

const spells = raw
  .map((s) => ({
    id: s.index,
    name: s.name,
    level: s.level,
    school: s.school.name,
    classes: s.classes.map((c) => c.index).sort(),
    castingTime: s.casting_time,
    range: s.range,
    components: s.components.join(', '),
    ...(s.material ? { material: s.material } : {}),
    ritual: Boolean(s.ritual),
    concentration: Boolean(s.concentration),
    duration: s.duration,
    text: s.desc.join('\n\n'),
    ...(s.higher_level?.length ? { higher: s.higher_level.join('\n\n') } : {}),
  }))
  .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

writeFileSync(new URL('../public/srd/spells.json', import.meta.url), JSON.stringify({ source: 'SRD 5.1 (CC BY 4.0)', spells }));
console.log(`${spells.length} spells written`);
