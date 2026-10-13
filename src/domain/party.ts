import type { Character } from './character';
import { formatNumber } from './format/number';
import { lifeState } from './hp/hp';
import { asArray, asBool, asInt, asOneOf, asRecord, asString } from './schema/sanitize';
import { CONDITIONS, LEVEL_MAX, SKILLS, type ConditionId, type SkillId } from './sheet/rules';
import { classSummary, passivePerception, totalLevel } from './sheet/sheet';

/**
 * Parties: join codes, the summary a member publishes into a party, the
 * "party at a glance" computed from those summaries, and validation of
 * everything read from a party (written by other users, so untrusted).
 */

export const PARTY_SCHEMA_VERSION = 1;
/** Soft limits, enforced in the UI only: Firestore rules cannot count documents. */
export const PARTY_LIMIT = 10;
export const MEMBER_LIMIT = 10;
export const LOG_PAGE = 20;

// --- Join codes ---

/** No 0/O, 1/I/L: codes are read aloud and typed on phones. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

/** `randomBelow(n)` must return a uniform integer in [0, n): pass the crypto one. */
export function generateJoinCode(randomBelow: (n: number) => number): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomBelow(CODE_ALPHABET.length)];
  return code;
}

/** Accepts "k7qm-x2pd", " K7QM X2PD " and the like; returns null when it cannot be a code. */
export function normalizeJoinCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((ch) => CODE_ALPHABET.includes(ch)) ? code : null;
}

export function formatJoinCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// --- Sharing and summary ---

export type HpVisibility = 'exact' | 'status' | 'hidden';
export const HP_VISIBILITIES: readonly HpVisibility[] = ['exact', 'status', 'hidden'];

export const SHARED_FIELDS = [
  'conditions',
  'ac',
  'passivePerception',
  'deathSaves',
  'inspiration',
  'languages',
  'skillProficiencies',
  'darkvision',
] as const;
export type SharedField = (typeof SHARED_FIELDS)[number];

export const SHARED_FIELD_LABELS: Readonly<Record<SharedField, string>> = {
  conditions: 'Condizioni',
  ac: 'CA',
  passivePerception: 'Percezione passiva',
  deathSaves: 'Tiri salvezza contro morte',
  inspiration: 'Ispirazione',
  languages: 'Lingue',
  skillProficiencies: 'Abilità competenti',
  darkvision: 'Scurovisione',
};

/** Name, class and level are always shared: a card needs them. */
export interface Sharing {
  hp: HpVisibility;
  fields: Record<SharedField, boolean>;
}

export function defaultSharing(): Sharing {
  return {
    hp: 'status',
    fields: Object.fromEntries(SHARED_FIELDS.map((f) => [f, f === 'conditions'])) as Record<SharedField, boolean>,
  };
}

export function sanitizeSharing(raw: unknown): Sharing {
  const s = asRecord(raw);
  const fields = asRecord(s.fields);
  const d = defaultSharing();
  return {
    hp: asOneOf(s.hp, HP_VISIBILITIES, d.hp),
    fields: Object.fromEntries(SHARED_FIELDS.map((f) => [f, asBool(fields[f], d.fields[f])])) as Record<SharedField, boolean>,
  };
}

export type HpStatus = 'sano' | 'ferito' | 'in fin di vita' | 'a terra' | 'morto';
export const HP_STATUSES: readonly HpStatus[] = ['sano', 'ferito', 'in fin di vita', 'a terra', 'morto'];

/** Above half: "sano"; down to a quarter: "ferito"; below: "in fin di vita"; 0: "a terra" (or "morto"). */
export function hpStatus(c: Pick<Character, 'hp' | 'deathSaves'>): HpStatus {
  const state = lifeState({ hp: c.hp, deathSaves: c.deathSaves });
  if (state === 'dead') return 'morto';
  if (c.hp.cur <= 0) return 'a terra';
  if (c.hp.cur * 2 > c.hp.max) return 'sano';
  if (c.hp.cur * 4 > c.hp.max) return 'ferito';
  return 'in fin di vita';
}

/** What the other members see. Optional fields are absent when not shared. */
export interface MemberSummary {
  characterName: string;
  class: string;
  level: number;
  hpStatus?: HpStatus;
  hpCur?: number;
  hpMax?: number;
  hpTemp?: number;
  conditions?: ConditionId[];
  exhaustion?: number;
  ac?: number;
  passivePerception?: number;
  deathSaves?: { successes: number; failures: number };
  inspiration?: boolean;
  languages?: string[];
  skillProficiencies?: SkillId[];
  darkvision?: number;
}

export function buildSummary(c: Character, sharing: Sharing): MemberSummary {
  const s = c.sheet;
  const f = sharing.fields;
  const out: MemberSummary = {
    characterName: c.name || 'Senza nome',
    class: classSummary(s.classes),
    level: totalLevel(s.classes),
  };
  if (sharing.hp !== 'hidden') out.hpStatus = hpStatus(c);
  if (sharing.hp === 'exact') Object.assign(out, { hpCur: c.hp.cur, hpMax: c.hp.max, hpTemp: c.hp.temp });
  if (f.conditions) Object.assign(out, { conditions: [...s.conditions], exhaustion: s.exhaustion });
  if (f.ac) out.ac = s.ac;
  if (f.passivePerception) out.passivePerception = passivePerception(s);
  if (f.deathSaves) out.deathSaves = { ...c.deathSaves };
  if (f.inspiration) out.inspiration = s.inspiration;
  if (f.languages) out.languages = [...s.languages];
  if (f.skillProficiencies) out.skillProficiencies = SKILLS.filter((k) => s.skills[k].prof >= 1);
  if (f.darkvision) out.darkvision = s.darkvisionM;
  return out;
}

/** Stable comparison, so an unchanged summary is never written again. */
export function sameSummary(a: MemberSummary | null | undefined, b: MemberSummary | null | undefined): boolean {
  const canon = (x: MemberSummary | null | undefined) =>
    x ? JSON.stringify(Object.keys(x).sort().map((k) => [k, x[k as keyof MemberSummary]])) : '';
  return canon(a) === canon(b);
}

const BIG = 9999;

/** Summaries come from other users: keep only known fields, clamp everything. */
export function sanitizeSummary(raw: unknown): MemberSummary {
  const s = asRecord(raw);
  const out: MemberSummary = {
    characterName: asString(s.characterName, 80) || 'Senza nome',
    class: asString(s.class, 200),
    level: asInt(s.level, 1, LEVEL_MAX, 1),
  };
  if (s.hpStatus !== undefined) out.hpStatus = asOneOf(s.hpStatus, HP_STATUSES, 'sano');
  if (typeof s.hpMax === 'number') {
    out.hpMax = asInt(s.hpMax, 1, BIG, 1);
    out.hpCur = asInt(s.hpCur, 0, out.hpMax, 0);
    out.hpTemp = asInt(s.hpTemp, 0, BIG, 0);
  }
  if (Array.isArray(s.conditions)) {
    const set = new Set(s.conditions);
    out.conditions = CONDITIONS.filter((c) => set.has(c));
    out.exhaustion = asInt(s.exhaustion, 0, 6, 0);
  }
  if (s.ac !== undefined) out.ac = asInt(s.ac, 0, 50, 10);
  if (s.passivePerception !== undefined) out.passivePerception = asInt(s.passivePerception, 0, 99, 10);
  if (s.deathSaves !== undefined) {
    const d = asRecord(s.deathSaves);
    out.deathSaves = { successes: asInt(d.successes, 0, 3, 0), failures: asInt(d.failures, 0, 3, 0) };
  }
  if (s.inspiration !== undefined) out.inspiration = asBool(s.inspiration);
  if (Array.isArray(s.languages)) {
    out.languages = asArray(s.languages, 20)
      .map((l) => asString(l, 40).trim())
      .filter(Boolean);
  }
  if (Array.isArray(s.skillProficiencies)) {
    const set = new Set(s.skillProficiencies);
    out.skillProficiencies = SKILLS.filter((k) => set.has(k));
  }
  if (s.darkvision !== undefined) out.darkvision = Math.max(0, Math.min(300, Number(s.darkvision) || 0));
  return out;
}

// --- Party at a glance (client-side, no extra writes) ---

export interface GlanceMember {
  uid: string;
  summary: MemberSummary;
}

export interface PartyGlance {
  averageLevel: number;
  /** null when nobody shares passive Perception. */
  bestPerception: { value: number; names: string[] } | null;
  languages: string[];
  /** Only over members who share their skills; null when nobody does. */
  skills: { covered: SkillId[]; missing: SkillId[] } | null;
  /** Names of the members with darkvision, among those who share it. */
  darkvision: string[];
  /** How many members share each kind of data, to say "based on 3 of 5". */
  sharing: { perception: number; languages: number; skills: number; darkvision: number };
}

export function partyGlance(members: readonly GlanceMember[]): PartyGlance {
  const sums = members.map((m) => m.summary);
  const averageLevel = sums.length ? sums.reduce((a, s) => a + s.level, 0) / sums.length : 0;

  const withPerception = sums.filter((s) => s.passivePerception !== undefined);
  const best = Math.max(...withPerception.map((s) => s.passivePerception!));
  const bestPerception = withPerception.length
    ? { value: best, names: withPerception.filter((s) => s.passivePerception === best).map((s) => s.characterName) }
    : null;

  const languages = new Map<string, string>();
  for (const s of sums) for (const l of s.languages ?? []) if (!languages.has(l.toLowerCase())) languages.set(l.toLowerCase(), l);

  const withSkills = sums.filter((s) => s.skillProficiencies !== undefined);
  const covered = new Set(withSkills.flatMap((s) => s.skillProficiencies!));

  const withDarkvision = sums.filter((s) => s.darkvision !== undefined);

  return {
    averageLevel,
    bestPerception,
    languages: [...languages.values()].sort((a, b) => a.localeCompare(b, 'it')),
    skills: withSkills.length
      ? { covered: SKILLS.filter((k) => covered.has(k)), missing: SKILLS.filter((k) => !covered.has(k)) }
      : null,
    darkvision: withDarkvision.filter((s) => s.darkvision! > 0).map((s) => s.characterName),
    sharing: {
      perception: withPerception.length,
      languages: sums.filter((s) => s.languages !== undefined).length,
      skills: withSkills.length,
      darkvision: withDarkvision.length,
    },
  };
}

// --- Documents read from a party ---

export interface NextSession {
  /** Epoch milliseconds. */
  at: number;
  place: string;
  note: string;
}

export interface Party {
  id: string;
  name: string;
  campaignName: string;
  ownerUid: string;
  joinCode: string;
  joinEnabled: boolean;
  currentLocation: string;
  nextSession: NextSession | null;
  updatedAt: number;
}

export type Role = 'dm' | 'player';

export interface Member {
  uid: string;
  username: string;
  role: Role;
  characterId: string;
  summary: MemberSummary;
  sharing: Sharing;
  joinedAt: number;
  updatedAt: number;
}

export type QuestStatus = 'active' | 'completed' | 'failed';
export const QUEST_STATUSES: readonly QuestStatus[] = ['active', 'completed', 'failed'];

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  updatedAt: number;
}

export interface LogEntry {
  id: string;
  title: string;
  body: string;
  /** "YYYY-MM-DD" or empty. */
  sessionDate: string;
  authorUid: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
}

/** Private mirror in users/{uid}/memberships/{partyId}: lets the app list parties and publish summaries without reading them. */
export interface Membership {
  partyId: string;
  name: string;
  role: Role;
  characterId: string;
  sharing: Sharing;
  joinedAt: number;
}

export const TEXT_LIMITS = {
  name: 60,
  campaign: 80,
  location: 80,
  place: 120,
  note: 500,
  questTitle: 100,
  questText: 2000,
  logTitle: 100,
  logBody: 10_000,
} as const;

const time = (v: unknown) => asInt(v, 0, Number.MAX_SAFE_INTEGER, 0);

export function sanitizeParty(id: string, raw: unknown): Party {
  const p = asRecord(raw);
  const next = p.nextSession === null || p.nextSession === undefined ? null : asRecord(p.nextSession);
  return {
    id,
    name: asString(p.name, TEXT_LIMITS.name) || 'Gruppo senza nome',
    campaignName: asString(p.campaignName, TEXT_LIMITS.campaign),
    ownerUid: asString(p.ownerUid, 128),
    joinCode: asString(p.joinCode, CODE_LENGTH),
    joinEnabled: asBool(p.joinEnabled, true),
    currentLocation: asString(p.currentLocation, TEXT_LIMITS.location),
    nextSession:
      next && time(next.at) > 0
        ? { at: time(next.at), place: asString(next.place, TEXT_LIMITS.place), note: asString(next.note, TEXT_LIMITS.note) }
        : null,
    updatedAt: time(p.updatedAt),
  };
}

export function sanitizeMember(uid: string, raw: unknown): Member {
  const m = asRecord(raw);
  return {
    uid,
    username: asString(m.username, 20),
    role: asOneOf(m.role, ['dm', 'player'] as const, 'player'),
    characterId: asString(m.characterId, 64),
    summary: sanitizeSummary(m.summary),
    sharing: sanitizeSharing(m.sharing),
    joinedAt: time(m.joinedAt),
    updatedAt: time(m.updatedAt),
  };
}

export function sanitizeQuest(id: string, raw: unknown): Quest {
  const q = asRecord(raw);
  return {
    id,
    title: asString(q.title, TEXT_LIMITS.questTitle) || 'Missione',
    description: asString(q.description, TEXT_LIMITS.questText),
    status: asOneOf(q.status, QUEST_STATUSES, 'active'),
    updatedAt: time(q.updatedAt),
  };
}

export function sanitizeLogEntry(id: string, raw: unknown): LogEntry {
  const e = asRecord(raw);
  const date = asString(e.sessionDate, 10);
  return {
    id,
    title: asString(e.title, TEXT_LIMITS.logTitle) || 'Sessione',
    body: asString(e.body, TEXT_LIMITS.logBody),
    sessionDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    authorUid: asString(e.authorUid, 128),
    authorName: asString(e.authorName, 20),
    createdAt: time(e.createdAt),
    updatedAt: time(e.updatedAt),
  };
}

export function sanitizeMembership(partyId: string, raw: unknown): Membership {
  const m = asRecord(raw);
  return {
    partyId,
    name: asString(m.name, TEXT_LIMITS.name) || 'Gruppo',
    role: asOneOf(m.role, ['dm', 'player'] as const, 'player'),
    characterId: asString(m.characterId, 64),
    sharing: sanitizeSharing(m.sharing),
    joinedAt: time(m.joinedAt),
  };
}

// --- Next session countdown ---

/** "tra 4 giorni e 3 ore", "tra 25 minuti", "in corso o passata" (no seconds: it is a table, not a race). */
export function countdown(at: number, now: number): string {
  const minutes = Math.floor((at - now) / 60_000);
  if (minutes < 0) return 'già iniziata o passata';
  if (minutes < 1) return 'tra meno di un minuto';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const unit = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;
  if (days > 0) return `tra ${unit(days, 'giorno', 'giorni')}` + (hours > 0 ? ` e ${unit(hours, 'ora', 'ore')}` : '');
  if (hours > 0) return `tra ${unit(hours, 'ora', 'ore')}` + (mins > 0 ? ` e ${unit(mins, 'minuto', 'minuti')}` : '');
  return `tra ${unit(mins, 'minuto', 'minuti')}`;
}

/** "sab 18 ott, 21:00" in the viewer's time zone. */
export function formatSessionDate(at: number): string {
  const d = new Date(at);
  const date = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const t = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${t}`;
}
