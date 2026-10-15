import { asArray, asInt, asRecord, asString } from './schema/sanitize';

/** A monster of the SRD 5.1 catalogue (public/srd/monsters.json, English text). */
export interface Monster {
  id: string;
  name: string;
  size: string;
  /** SRD creature type: 'dragon', 'undead', 'swarm of Tiny beasts'… */
  type: string;
  subtype?: string;
  alignment: string;
  ac: number;
  acNote?: string;
  hp: number;
  hpRoll: string;
  speed: string;
  /** STR, DEX, CON, INT, WIS, CHA. */
  abilities: number[];
  saves?: string;
  skills?: string;
  vulnerabilities?: string;
  resistances?: string;
  immunities?: string;
  conditionImmunities?: string;
  senses: string;
  languages: string;
  cr: number;
  xp: number;
  traits: Feature[];
  actions: Feature[];
  reactions?: Feature[];
  legendary?: Feature[];
}

export interface Feature {
  name: string;
  text: string;
}

export const MONSTER_LIMITS = { catalogue: 400, features: 40, text: 4000 } as const;

const sanitizeFeatures = (raw: unknown): Feature[] =>
  asArray(raw, MONSTER_LIMITS.features).map((f) => {
    const r = asRecord(f);
    return { name: asString(r.name, 120), text: asString(r.text, MONSTER_LIMITS.text) };
  });

const optional = (v: unknown, max: number) => (typeof v === 'string' && v !== '' ? asString(v, max) : undefined);

export function sanitizeMonsterCatalogue(raw: unknown): Monster[] {
  return asArray(asRecord(raw).monsters, MONSTER_LIMITS.catalogue).flatMap((x) => {
    const m = asRecord(x);
    const id = asString(m.id, 80);
    const name = asString(m.name, 80);
    if (!id || !name) return [];
    const abilities = asArray(m.abilities, 6).map((a) => asInt(a, 1, 30, 10));
    while (abilities.length < 6) abilities.push(10);
    const monster: Monster = {
      id,
      name,
      size: asString(m.size, 20),
      type: asString(m.type, 40),
      alignment: asString(m.alignment, 60),
      ac: asInt(m.ac, 0, 40, 10),
      hp: asInt(m.hp, 0, 2000, 1),
      hpRoll: asString(m.hpRoll, 30),
      speed: asString(m.speed, 160),
      abilities,
      cr: typeof m.cr === 'number' && Number.isFinite(m.cr) ? Math.min(30, Math.max(0, m.cr)) : 0,
      xp: asInt(m.xp, 0, 1_000_000, 0),
      senses: asString(m.senses, 200),
      languages: asString(m.languages, 200),
      traits: sanitizeFeatures(m.traits),
      actions: sanitizeFeatures(m.actions),
    };
    const extra: [keyof Monster, string | undefined][] = [
      ['subtype', optional(m.subtype, 40)],
      ['acNote', optional(m.acNote, 60)],
      ['saves', optional(m.saves, 160)],
      ['skills', optional(m.skills, 200)],
      ['vulnerabilities', optional(m.vulnerabilities, 200)],
      ['resistances', optional(m.resistances, 300)],
      ['immunities', optional(m.immunities, 300)],
      ['conditionImmunities', optional(m.conditionImmunities, 200)],
    ];
    for (const [key, value] of extra) if (value !== undefined) (monster as unknown as Record<string, unknown>)[key] = value;
    if (Array.isArray(m.reactions) && m.reactions.length > 0) monster.reactions = sanitizeFeatures(m.reactions);
    if (Array.isArray(m.legendary) && m.legendary.length > 0) monster.legendary = sanitizeFeatures(m.legendary);
    return [monster];
  });
}

// --- Reading the catalogue ---

/** Challenge rating as printed: 0, 1/8, 1/4, 1/2, 1… */
export function formatCr(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
}

/** The filter key of a creature type: every «swarm of Tiny beasts» is a swarm. */
export const typeKey = (type: string): string => (type.startsWith('swarm') ? 'swarm' : type);

export const TYPE_LABELS: Readonly<Record<string, string>> = {
  aberration: 'Aberrazione',
  beast: 'Bestia',
  celestial: 'Celestiale',
  construct: 'Costrutto',
  dragon: 'Drago',
  elemental: 'Elementale',
  fey: 'Fatato',
  fiend: 'Immondo',
  giant: 'Gigante',
  humanoid: 'Umanoide',
  monstrosity: 'Mostruosità',
  ooze: 'Melma',
  plant: 'Pianta',
  swarm: 'Sciame',
  undead: 'Non morto',
};

export const SIZE_LABELS: Readonly<Record<string, string>> = {
  Tiny: 'Minuscola',
  Small: 'Piccola',
  Medium: 'Media',
  Large: 'Grande',
  Huge: 'Enorme',
  Gargantuan: 'Mastodontica',
};

export const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const;

export const typeLabel = (type: string): string => TYPE_LABELS[typeKey(type)] ?? type;

export const CR_STEPS = [0, 0.125, 0.25, 0.5, ...Array.from({ length: 30 }, (_, i) => i + 1)] as const;

export interface MonsterFilter {
  query: string;
  /** '' for any. */
  type: string;
  size: string;
  crMin: number;
  crMax: number;
}

export const NO_FILTER: MonsterFilter = { query: '', type: '', size: '', crMin: 0, crMax: 30 };

/** A filter read back from storage: anything unexpected falls back to «no filter» for that field. */
export function sanitizeFilter(raw: unknown): MonsterFilter {
  const r = asRecord(raw);
  const cr = (v: unknown, fallback: number) => (typeof v === 'number' && CR_STEPS.includes(v) ? v : fallback);
  const crMin = cr(r.crMin, NO_FILTER.crMin);
  const crMax = Math.max(crMin, cr(r.crMax, NO_FILTER.crMax));
  return {
    query: asString(r.query, 80),
    type: typeof r.type === 'string' && r.type in TYPE_LABELS ? r.type : '',
    size: typeof r.size === 'string' && (SIZES as readonly string[]).includes(r.size) ? r.size : '',
    crMin,
    crMax,
  };
}

export function filterMonsters(list: readonly Monster[], f: MonsterFilter): Monster[] {
  const q = f.query.trim().toLowerCase();
  return list.filter(
    (m) =>
      (q === '' || m.name.toLowerCase().includes(q)) &&
      (f.type === '' || typeKey(m.type) === f.type) &&
      (f.size === '' || m.size === f.size) &&
      m.cr >= f.crMin &&
      m.cr <= f.crMax,
  );
}

// --- The party's bestiary ---

/** The parts of a stat block a party can know. Which ones are known is told by hand, as the DM reveals them. */
export const REVEAL_SECTIONS = ['ac', 'hp', 'speed', 'abilities', 'saves', 'defenses', 'senses', 'languages', 'cr', 'traits', 'actions', 'legendary'] as const;
export type RevealSection = (typeof REVEAL_SECTIONS)[number];

export const REVEAL_LABELS: Readonly<Record<RevealSection, string>> = {
  ac: 'Classe armatura',
  hp: 'Punti ferita',
  speed: 'Velocità',
  abilities: 'Caratteristiche',
  saves: 'Tiri salvezza e abilità',
  defenses: 'Resistenze e immunità',
  senses: 'Sensi',
  languages: 'Linguaggi',
  cr: 'Grado di sfida',
  traits: 'Tratti speciali',
  actions: 'Azioni e reazioni',
  legendary: 'Azioni leggendarie',
};

export const BESTIARY_LIMITS = { entries: 300, name: 80, place: 100, notes: 2000, customText: 40 } as const;
export const BESTIARY_SCHEMA_VERSION = 1;

/** What is typed in for a creature that is not in the SRD. */
export interface CustomFacts {
  ac: number | null;
  hp: string;
  speed: string;
}

export interface BestiaryEntry {
  id: string;
  name: string;
  /** The SRD monster this entry is about, or null for a creature the group made up or met outside the SRD. */
  srdId: string | null;
  /** Free text, only used when there is no SRD monster. */
  creatureType: string;
  place: string;
  notes: string;
  revealed: RevealSection[];
  custom: CustomFacts;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
}

export const NO_CUSTOM: CustomFacts = { ac: null, hp: '', speed: '' };

/** A document from the party's bestiary: keep known fields, clamp everything (it comes from other users). */
export function sanitizeEntry(id: string, raw: unknown): BestiaryEntry {
  const e = asRecord(raw);
  const known = new Set(asArray(e.revealed, 40));
  const custom = asRecord(e.custom);
  return {
    id,
    name: asString(e.name, BESTIARY_LIMITS.name) || 'Creatura senza nome',
    srdId: typeof e.srdId === 'string' && e.srdId !== '' ? asString(e.srdId, 80) : null,
    creatureType: asString(e.creatureType, BESTIARY_LIMITS.customText),
    place: asString(e.place, BESTIARY_LIMITS.place),
    notes: asString(e.notes, BESTIARY_LIMITS.notes),
    revealed: REVEAL_SECTIONS.filter((s) => known.has(s)),
    custom: {
      ac: typeof custom.ac === 'number' ? asInt(custom.ac, 0, 40, 10) : null,
      hp: asString(custom.hp, BESTIARY_LIMITS.customText),
      speed: asString(custom.speed, BESTIARY_LIMITS.customText),
    },
    createdBy: asString(e.createdBy, 64),
    createdByName: asString(e.createdByName, 60),
    createdAt: asInt(e.createdAt, 0, Number.MAX_SAFE_INTEGER, 0),
    updatedAt: asInt(e.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

/** The sections that can be revealed for an entry: the whole stat block for an SRD monster, three facts otherwise. */
export function revealableSections(entry: Pick<BestiaryEntry, 'srdId'>, monster: Monster | undefined): RevealSection[] {
  if (!entry.srdId || !monster) return ['ac', 'hp', 'speed'];
  return REVEAL_SECTIONS.filter((s) => {
    if (s === 'saves') return Boolean(monster.saves || monster.skills);
    if (s === 'defenses') return Boolean(monster.vulnerabilities || monster.resistances || monster.immunities || monster.conditionImmunities);
    if (s === 'legendary') return Boolean(monster.legendary?.length);
    if (s === 'traits') return monster.traits.length > 0;
    return true;
  });
}

/** How much of an entry is filled in: known sections out of the ones that exist. */
export function completeness(entry: BestiaryEntry, monster: Monster | undefined): { known: number; total: number } {
  const all = revealableSections(entry, monster);
  return { known: all.filter((s) => entry.revealed.includes(s)).length, total: all.length };
}

export function toggleReveal(revealed: readonly RevealSection[], section: RevealSection): RevealSection[] {
  const on = new Set(revealed);
  if (on.has(section)) on.delete(section);
  else on.add(section);
  return REVEAL_SECTIONS.filter((s) => on.has(s));
}

/** The number shown on a card, from the alphabetical position in the catalogue; null for a creature outside it. */
export function entryNumber(entry: Pick<BestiaryEntry, 'srdId'>, catalogue: readonly Monster[]): number | null {
  if (!entry.srdId) return null;
  const i = catalogue.findIndex((m) => m.id === entry.srdId);
  return i < 0 ? null : i + 1;
}
