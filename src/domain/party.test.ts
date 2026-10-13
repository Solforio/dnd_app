import { describe, expect, it } from 'vitest';
import { createCharacter, type Character } from './character';
import {
  buildSummary,
  CODE_ALPHABET,
  CODE_LENGTH,
  countdown,
  defaultSharing,
  formatJoinCode,
  generateJoinCode,
  hpStatus,
  normalizeJoinCode,
  partyGlance,
  sameSummary,
  sanitizeLogEntry,
  sanitizeMember,
  sanitizeParty,
  sanitizeSharing,
  sanitizeSummary,
  type MemberSummary,
  type Sharing,
} from './party';

function thorin(): Character {
  const c = createCharacter('Thorin');
  c.hp = { cur: 30, max: 44, temp: 5 };
  c.sheet.classes = [{ name: 'Guerriero', subclass: '', level: 5 }];
  c.sheet.abilities.wis = 13;
  c.sheet.skills.perception = { prof: 1, bonus: 0 };
  c.sheet.skills.athletics = { prof: 2, bonus: 0 };
  c.sheet.skills.stealth = { prof: 0.5, bonus: 0 };
  c.sheet.ac = 18;
  c.sheet.conditions = ['poisoned'];
  c.sheet.languages = ['Comune', 'Nanico'];
  c.sheet.darkvisionM = 18;
  return c;
}

function shareAll(): Sharing {
  const s = defaultSharing();
  for (const k of Object.keys(s.fields) as (keyof Sharing['fields'])[]) s.fields[k] = true;
  return { ...s, hp: 'exact' };
}

describe('join codes', () => {
  it('generates codes from the unambiguous alphabet', () => {
    let i = 0;
    const code = generateJoinCode(() => i++ % CODE_ALPHABET.length);
    expect(code).toBe('ABCDEFGH');
    expect(code).toHaveLength(CODE_LENGTH);
  });

  it('normalizes what people type', () => {
    expect(normalizeJoinCode(' k7qm-x2pd ')).toBe('K7QMX2PD');
    expect(normalizeJoinCode('K7QM X2PD')).toBe('K7QMX2PD');
    expect(normalizeJoinCode('K7QM0X2P')).toBeNull(); // 0 is not in the alphabet
    expect(normalizeJoinCode('K7QM')).toBeNull();
    expect(formatJoinCode('K7QMX2PD')).toBe('K7QM-X2PD');
  });
});

describe('hp status', () => {
  const at = (cur: number, max = 40, failures = 0) =>
    hpStatus({ hp: { cur, max, temp: 0 }, deathSaves: { successes: 0, failures: failures as 0 } });
  it('follows the thresholds', () => {
    expect([at(40), at(21), at(20), at(11), at(10), at(1), at(0), at(0, 40, 3)]).toEqual([
      'sano',
      'sano',
      'ferito',
      'ferito',
      'in fin di vita',
      'in fin di vita',
      'a terra',
      'morto',
    ]);
  });
});

describe('summary', () => {
  it('shares only name, class, level, HP status and conditions by default', () => {
    expect(buildSummary(thorin(), defaultSharing())).toEqual({
      characterName: 'Thorin',
      class: 'Guerriero 5',
      level: 5,
      hpStatus: 'sano',
      conditions: ['poisoned'],
      exhaustion: 0,
    });
  });

  it('hides HP entirely, or shows exact values', () => {
    const hidden = buildSummary(thorin(), { ...defaultSharing(), hp: 'hidden' });
    expect(hidden.hpStatus).toBeUndefined();
    expect(hidden.hpCur).toBeUndefined();
    expect(buildSummary(thorin(), { ...defaultSharing(), hp: 'exact' })).toMatchObject({ hpCur: 30, hpMax: 44, hpTemp: 5 });
  });

  it('shares every opt-in field when asked, with proficient skills only (not half)', () => {
    const s = buildSummary(thorin(), shareAll());
    expect(s).toMatchObject({
      ac: 18,
      passivePerception: 14,
      inspiration: false,
      languages: ['Comune', 'Nanico'],
      skillProficiencies: ['athletics', 'perception'],
      darkvision: 18,
      deathSaves: { successes: 0, failures: 0 },
    });
  });

  it('compares summaries regardless of key order', () => {
    const a = buildSummary(thorin(), shareAll());
    const b = Object.fromEntries(Object.entries(a).reverse()) as MemberSummary;
    expect(sameSummary(a, b)).toBe(true);
    expect(sameSummary(a, { ...a, ac: 19 })).toBe(false);
    expect(sameSummary(null, a)).toBe(false);
  });

  it('round-trips through sanitizeSummary', () => {
    const s = buildSummary(thorin(), shareAll());
    expect(sanitizeSummary(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('clamps a hostile summary', () => {
    const s = sanitizeSummary({
      characterName: 'x'.repeat(500),
      level: 99,
      hpStatus: 'immortale',
      hpCur: 500,
      hpMax: 10,
      conditions: ['prone', '<script>'],
      skillProficiencies: ['stealth', 'hacking'],
      darkvision: 'molta',
      evil: true,
    });
    expect(s.characterName).toHaveLength(80);
    expect(s).toMatchObject({ level: 20, hpStatus: 'sano', hpCur: 10, hpMax: 10, conditions: ['prone'], skillProficiencies: ['stealth'], darkvision: 0 });
    expect('evil' in s).toBe(false);
  });
});

describe('sharing', () => {
  it('fills defaults and drops unknown values', () => {
    expect(sanitizeSharing(undefined)).toEqual(defaultSharing());
    expect(sanitizeSharing({ hp: 'everything', fields: { ac: true, secrets: true } })).toEqual({
      ...defaultSharing(),
      fields: { ...defaultSharing().fields, ac: true },
    });
  });
});

describe('party at a glance', () => {
  const member = (uid: string, summary: Partial<MemberSummary>) => ({
    uid,
    summary: { characterName: uid, class: '', level: 1, ...summary },
  });

  it('combines what members share', () => {
    const g = partyGlance([
      member('Thorin', { level: 5, passivePerception: 14, languages: ['Comune', 'Nanico'], skillProficiencies: ['athletics'], darkvision: 18 }),
      member('Elara', { level: 4, passivePerception: 14, languages: ['comune', 'Elfico'], skillProficiencies: ['arcana'], darkvision: 0 }),
      member('Pip', { level: 4 }),
    ]);
    expect(g.averageLevel).toBeCloseTo(13 / 3);
    expect(g.bestPerception).toEqual({ value: 14, names: ['Thorin', 'Elara'] });
    expect(g.languages).toEqual(['Comune', 'Elfico', 'Nanico']);
    expect(g.skills!.covered).toEqual(['arcana', 'athletics']);
    expect(g.skills!.missing).toHaveLength(16);
    expect(g.darkvision).toEqual(['Thorin']);
    expect(g.sharing).toEqual({ perception: 2, languages: 2, skills: 2, darkvision: 2 });
  });

  it('says nothing about data nobody shares', () => {
    const g = partyGlance([member('Pip', { level: 2 })]);
    expect(g.bestPerception).toBeNull();
    expect(g.skills).toBeNull();
    expect(g.languages).toEqual([]);
  });
});

describe('documents from a party', () => {
  it('sanitizes a party and its next session', () => {
    const p = sanitizeParty('p1', { name: '', ownerUid: 'u1', joinCode: 'ABCDEFGH', nextSession: { at: 'domani' } });
    expect(p).toMatchObject({ id: 'p1', name: 'Gruppo senza nome', joinEnabled: true, nextSession: null });
    expect(sanitizeParty('p1', { nextSession: { at: 5, place: 'Da Marco' } }).nextSession).toEqual({ at: 5, place: 'Da Marco', note: '' });
  });

  it('sanitizes members and log entries', () => {
    expect(sanitizeMember('u2', { role: 'king', summary: { characterName: 'Pip' } })).toMatchObject({ uid: 'u2', role: 'player' });
    expect(sanitizeLogEntry('e1', { sessionDate: '2026-10-18', body: 'Ciao' }).sessionDate).toBe('2026-10-18');
    expect(sanitizeLogEntry('e1', { sessionDate: 'ieri' }).sessionDate).toBe('');
  });
});

describe('countdown', () => {
  const now = Date.UTC(2026, 9, 13, 12, 0);
  const min = 60_000;
  it('speaks Italian with the right units', () => {
    expect(countdown(now + (4 * 1440 + 3 * 60) * min, now)).toBe('tra 4 giorni e 3 ore');
    expect(countdown(now + 1440 * min, now)).toBe('tra 1 giorno');
    expect(countdown(now + 61 * min, now)).toBe('tra 1 ora e 1 minuto');
    expect(countdown(now + 25 * min, now)).toBe('tra 25 minuti');
    expect(countdown(now + 10_000, now)).toBe('tra meno di un minuto');
    expect(countdown(now - min, now)).toBe('già iniziata o passata');
  });
});
