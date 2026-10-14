import { describe, expect, it } from 'vitest';
import { applyItalian, type Spell } from './spells';
import { castingTimeLabel, durationLabel, rangeLabel, schoolLabel } from './spellItalian';

describe('Italian spell labels', () => {
  it('translates schools', () => {
    expect(schoolLabel('Evocation')).toBe('Invocazione');
    expect(schoolLabel('Conjuration')).toBe('Evocazione');
    expect(schoolLabel('Unknown')).toBe('Unknown');
  });

  it('translates casting times', () => {
    expect(castingTimeLabel('1 action')).toBe('1 azione');
    expect(castingTimeLabel('1 bonus action')).toBe('1 azione bonus');
    expect(castingTimeLabel('1 reaction')).toBe('1 reazione');
    expect(castingTimeLabel('10 minutes')).toBe('10 minuti');
    expect(castingTimeLabel('8 hours')).toBe('8 ore');
  });

  it('converts ranges to metres and kilometres', () => {
    expect(rangeLabel('60 feet')).toBe('18 m');
    expect(rangeLabel('5 feet')).toBe('1,5 m');
    expect(rangeLabel('120 feet')).toBe('36 m');
    expect(rangeLabel('1 mile')).toBe('1,5 km');
    expect(rangeLabel('500 miles')).toBe('750 km');
    expect(rangeLabel('Touch')).toBe('Contatto');
    expect(rangeLabel('Self')).toBe('Personale');
  });

  it('translates durations', () => {
    expect(durationLabel('Instantaneous')).toBe('Istantanea');
    expect(durationLabel('Up to 1 minute')).toBe('Fino a 1 minuto');
    expect(durationLabel('Up to 8 hours')).toBe('Fino a 8 ore');
    expect(durationLabel('10 days')).toBe('10 giorni');
    expect(durationLabel('Until dispelled')).toBe('Finché non viene dissolto');
    expect(durationLabel('1 round')).toBe('1 round');
  });
});

describe('applyItalian', () => {
  const base: Spell = {
    id: 'magic-missile', name: 'Magic Missile', level: 1, school: 'Evocation', classes: ['wizard'], castingTime: '1 action',
    range: '120 feet', components: 'V, S', ritual: false, concentration: false, duration: 'Instantaneous', text: 'English', higher: 'More',
  };

  it('replaces the texts and keeps the English name for searching', () => {
    const [sp] = applyItalian([base], { 'magic-missile': { name: 'Dardo Incantato', text: 'Italiano', higher: 'Di più' } });
    expect(sp).toMatchObject({ name: 'Dardo Incantato', nameEn: 'Magic Missile', text: 'Italiano', higher: 'Di più' });
  });

  it('leaves untranslated spells and a missing overlay in English', () => {
    expect(applyItalian([base], null)).toEqual([base]);
    expect(applyItalian([base], { other: { name: 'X', text: 'Y' } })).toEqual([base]);
  });
});
