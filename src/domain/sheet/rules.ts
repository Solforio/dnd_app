/** Fixed D&D 5e (SRD 5.1) tables used by the character sheet, with their Italian labels. */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_LABELS: Readonly<Record<Ability, { short: string; long: string }>> = {
  str: { short: 'FOR', long: 'Forza' },
  dex: { short: 'DES', long: 'Destrezza' },
  con: { short: 'COS', long: 'Costituzione' },
  int: { short: 'INT', long: 'Intelligenza' },
  wis: { short: 'SAG', long: 'Saggezza' },
  cha: { short: 'CAR', long: 'Carisma' },
};

export const SKILLS = [
  'acrobatics',
  'animalHandling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleightOfHand',
  'stealth',
  'survival',
] as const;
export type SkillId = (typeof SKILLS)[number];

export const SKILL_INFO: Readonly<Record<SkillId, { label: string; ability: Ability }>> = {
  acrobatics: { label: 'Acrobazia', ability: 'dex' },
  animalHandling: { label: 'Addestrare animali', ability: 'wis' },
  arcana: { label: 'Arcano', ability: 'int' },
  athletics: { label: 'Atletica', ability: 'str' },
  deception: { label: 'Inganno', ability: 'cha' },
  history: { label: 'Storia', ability: 'int' },
  insight: { label: 'Intuizione', ability: 'wis' },
  intimidation: { label: 'Intimidire', ability: 'cha' },
  investigation: { label: 'Indagare', ability: 'int' },
  medicine: { label: 'Medicina', ability: 'wis' },
  nature: { label: 'Natura', ability: 'int' },
  perception: { label: 'Percezione', ability: 'wis' },
  performance: { label: 'Intrattenere', ability: 'cha' },
  persuasion: { label: 'Persuasione', ability: 'cha' },
  religion: { label: 'Religione', ability: 'int' },
  sleightOfHand: { label: 'Rapidità di mano', ability: 'dex' },
  stealth: { label: 'Furtività', ability: 'dex' },
  survival: { label: 'Sopravvivenza', ability: 'wis' },
};

/** The SRD conditions. Exhaustion has levels, so it is stored apart (`exhaustion`, 0 to 6). */
export const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const;
export type ConditionId = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Readonly<Record<ConditionId, string>> = {
  blinded: 'Accecato',
  charmed: 'Affascinato',
  deafened: 'Assordato',
  frightened: 'Spaventato',
  grappled: 'Afferrato',
  incapacitated: 'Incapacitato',
  invisible: 'Invisibile',
  paralyzed: 'Paralizzato',
  petrified: 'Pietrificato',
  poisoned: 'Avvelenato',
  prone: 'Prono',
  restrained: 'Trattenuto',
  stunned: 'Stordito',
  unconscious: 'Privo di sensi',
};

export const EXHAUSTION_MAX = 6;
export const LEVEL_MAX = 20;
