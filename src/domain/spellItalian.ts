/** Italian wording of the short SRD spell fields (the catalogue data stays in English: the logic parses it). */

const SCHOOLS: Record<string, string> = {
  Abjuration: 'Abiurazione',
  Conjuration: 'Evocazione',
  Divination: 'Divinazione',
  Enchantment: 'Ammaliamento',
  Evocation: 'Invocazione',
  Illusion: 'Illusione',
  Necromancy: 'Negromanzia',
  Transmutation: 'Trasmutazione',
};

const WORDS: Record<string, string> = {
  touch: 'Contatto',
  self: 'Personale',
  sight: 'Vista',
  unlimited: 'Illimitata',
  special: 'Speciale',
  instantaneous: 'Istantanea',
  'until dispelled': 'Finché non viene dissolto',
};

const UNITS: Record<string, [string, string]> = {
  action: ['azione', 'azioni'],
  'bonus action': ['azione bonus', 'azioni bonus'],
  reaction: ['reazione', 'reazioni'],
  round: ['round', 'round'],
  minute: ['minuto', 'minuti'],
  hour: ['ora', 'ore'],
  day: ['giorno', 'giorni'],
};

const comma = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** «3 minutes» → «3 minuti»; null when the text is not a count and a unit. */
function counted(text: string): string | null {
  const m = /^(\d+) (action|bonus action|reaction|round|minute|hour|day)s?$/i.exec(text.trim());
  const names = m?.[2] ? UNITS[m[2].toLowerCase()] : undefined;
  if (!m || !names) return null;
  const n = Number(m[1]);
  return `${n} ${n === 1 ? names[0] : names[1]}`;
}

export const schoolLabel = (school: string): string => SCHOOLS[school] ?? school;

export function castingTimeLabel(text: string): string {
  return counted(text) ?? text;
}

/** Feet become metres (5 ft = 1,5 m) and miles kilometres (1 mile = 1,5 km), as in the Italian Player's Handbook. */
export function rangeLabel(text: string): string {
  const word = WORDS[text.trim().toLowerCase()];
  if (word) return word;
  const m = /^(\d+) (feet|foot|mile|miles)$/i.exec(text.trim());
  if (!m) return text;
  const n = Number(m[1]);
  return (m[2] ?? '').toLowerCase().startsWith('mile') ? `${comma(n * 1.5)} km` : `${comma(n * 0.3)} m`;
}

export function durationLabel(text: string): string {
  const t = text.trim();
  const word = WORDS[t.toLowerCase()];
  if (word) return word;
  const upTo = /^up to (.+)$/i.exec(t);
  const rest = upTo?.[1];
  if (rest) return `Fino a ${counted(rest) ?? rest}`;
  return counted(t) ?? text;
}
