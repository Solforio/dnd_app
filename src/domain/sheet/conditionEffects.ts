import { EXHAUSTION_MAX, type ConditionId } from './rules';

/**
 * What each condition does, from the SRD 5.1 (CC-BY 4.0), summarised in
 * Italian for the table. Shown on the sheet while a condition is active.
 */

export const CONDITIONS_SOURCE = 'Effetti delle condizioni dal System Reference Document 5.1 (CC-BY 4.0).';

export interface ConditionEffect {
  /** One line, for the at-a-glance list. */
  summary: string;
  /** The full effect, one rule per line. */
  details: string[];
  /** Conditions this one includes (e.g. Paralizzato includes Incapacitato). */
  includes?: ConditionId[];
}

export const CONDITION_EFFECTS: Readonly<Record<ConditionId, ConditionEffect>> = {
  blinded: {
    summary: 'Non vedi: i tuoi attacchi hanno svantaggio, quelli contro di te vantaggio.',
    details: [
      'Non puoi vedere e fallisci automaticamente le prove di caratteristica che richiedono la vista.',
      'I tiri per colpire contro di te hanno vantaggio; i tuoi tiri per colpire hanno svantaggio.',
    ],
  },
  charmed: {
    summary: 'Non puoi attaccare chi ti ha affascinato; lui ha vantaggio nelle interazioni sociali con te.',
    details: [
      'Non puoi attaccare chi ti ha affascinato, né bersagliarlo con capacità o effetti magici dannosi.',
      'Chi ti ha affascinato ha vantaggio alle prove di caratteristica per interagire socialmente con te.',
    ],
  },
  deafened: {
    summary: 'Non senti: fallisci le prove che richiedono l’udito.',
    details: ['Non puoi sentire e fallisci automaticamente le prove di caratteristica che richiedono l’udito.'],
  },
  frightened: {
    summary: 'Svantaggio a prove e attacchi finché vedi la fonte della paura; non puoi avvicinarti a essa.',
    details: [
      'Hai svantaggio alle prove di caratteristica e ai tiri per colpire finché la fonte della paura è nella tua linea di vista.',
      'Non puoi muoverti volontariamente più vicino alla fonte della paura.',
    ],
  },
  grappled: {
    summary: 'Velocità 0.',
    details: [
      'La tua velocità diventa 0 e non puoi beneficiare di bonus alla velocità.',
      'Finisce se chi ti afferra diventa incapacitato, o se un effetto ti porta fuori dalla sua portata.',
    ],
  },
  incapacitated: {
    summary: 'Niente azioni né reazioni.',
    details: ['Non puoi effettuare azioni né reazioni.'],
  },
  invisible: {
    summary: 'Non ti vedono: i tuoi attacchi hanno vantaggio, quelli contro di te svantaggio.',
    details: [
      'Non puoi essere visto senza magia o sensi speciali; per nasconderti conti come in un’area pesantemente oscurata. Rumori e tracce possono rivelare dove sei.',
      'I tiri per colpire contro di te hanno svantaggio; i tuoi tiri per colpire hanno vantaggio.',
    ],
  },
  paralyzed: {
    summary: 'Incapacitato, immobile e muto; fallisci i TS su FOR e DES; colpito da vicino è un critico.',
    includes: ['incapacitated'],
    details: [
      'Sei incapacitato e non puoi muoverti né parlare.',
      'Fallisci automaticamente i tiri salvezza su Forza e Destrezza.',
      'I tiri per colpire contro di te hanno vantaggio.',
      'Ogni attacco che ti colpisce da entro 1,5 m è un colpo critico.',
    ],
  },
  petrified: {
    summary: 'Trasformato in pietra: incapacitato, inconsapevole, resistenza a tutti i danni.',
    includes: ['incapacitated'],
    details: [
      'Tu e gli oggetti non magici che indossi o trasporti diventate una sostanza solida inanimata; il peso aumenta di dieci volte e smetti di invecchiare.',
      'Sei incapacitato, non puoi muoverti né parlare e non sei consapevole di ciò che ti circonda.',
      'I tiri per colpire contro di te hanno vantaggio.',
      'Fallisci automaticamente i tiri salvezza su Forza e Destrezza.',
      'Hai resistenza a tutti i danni.',
      'Sei immune a veleno e malattie; quelli già presenti sono sospesi, non neutralizzati.',
    ],
  },
  poisoned: {
    summary: 'Svantaggio ai tiri per colpire e alle prove di caratteristica.',
    details: ['Hai svantaggio ai tiri per colpire e alle prove di caratteristica.'],
  },
  prone: {
    summary: 'Puoi solo strisciare; svantaggio ai tuoi attacchi; vantaggio a chi ti attacca da vicino.',
    details: [
      'Puoi solo strisciare (ogni metro costa il doppio), finché non ti rialzi spendendo metà del movimento.',
      'Hai svantaggio ai tiri per colpire.',
      'Chi ti attacca da entro 1,5 m ha vantaggio; da più lontano ha svantaggio.',
    ],
  },
  restrained: {
    summary: 'Velocità 0; svantaggio ai tuoi attacchi e ai TS su DES; vantaggio a chi ti attacca.',
    details: [
      'La tua velocità diventa 0 e non puoi beneficiare di bonus alla velocità.',
      'I tiri per colpire contro di te hanno vantaggio; i tuoi tiri per colpire hanno svantaggio.',
      'Hai svantaggio ai tiri salvezza su Destrezza.',
    ],
  },
  stunned: {
    summary: 'Incapacitato e immobile; fallisci i TS su FOR e DES; vantaggio a chi ti attacca.',
    includes: ['incapacitated'],
    details: [
      'Sei incapacitato, non puoi muoverti e parli solo a fatica.',
      'Fallisci automaticamente i tiri salvezza su Forza e Destrezza.',
      'I tiri per colpire contro di te hanno vantaggio.',
    ],
  },
  unconscious: {
    summary: 'Privo di sensi e prono; fallisci i TS su FOR e DES; colpito da vicino è un critico.',
    includes: ['incapacitated', 'prone'],
    details: [
      'Sei incapacitato, non puoi muoverti né parlare e non sei consapevole di ciò che ti circonda.',
      'Lasci cadere ciò che stai tenendo e cadi prono.',
      'Fallisci automaticamente i tiri salvezza su Forza e Destrezza.',
      'I tiri per colpire contro di te hanno vantaggio.',
      'Ogni attacco che ti colpisce da entro 1,5 m è un colpo critico.',
    ],
  },
};

/** Effects of exhaustion by level (index 0 = level 1). They add up. */
const EXHAUSTION_LEVELS = [
  'Svantaggio alle prove di caratteristica.',
  'Velocità dimezzata.',
  'Svantaggio ai tiri per colpire e ai tiri salvezza.',
  'Punti ferita massimi dimezzati.',
  'Velocità 0.',
  'Morte.',
] as const;

/** Every effect up to `level` (cumulative), empty at 0. */
export function exhaustionEffects(level: number): string[] {
  const n = Math.min(EXHAUSTION_MAX, Math.max(0, Math.trunc(level)));
  return EXHAUSTION_LEVELS.slice(0, n);
}

/**
 * Conditions implied by the active ones but not ticked themselves, so the
 * sheet can say "include anche Incapacitato".
 */
export function impliedConditions(active: readonly ConditionId[]): ConditionId[] {
  const set = new Set(active);
  const implied = new Set<ConditionId>();
  for (const c of active) for (const i of CONDITION_EFFECTS[c].includes ?? []) if (!set.has(i)) implied.add(i);
  return [...implied];
}
