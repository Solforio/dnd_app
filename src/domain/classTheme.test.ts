import { describe, expect, it } from 'vitest';
import { classRgb, DEFAULT_CLASS_RGB } from './classTheme';

describe('class colours', () => {
  it('knows the twelve classes by Italian or English name, ignoring case and spaces', () => {
    expect(classRgb('Mago')).toBe(classRgb(' wizard '));
    expect(classRgb('Guerriero')).toBe(classRgb('FIGHTER'));
    const names = ['Barbaro', 'Bardo', 'Chierico', 'Druido', 'Guerriero', 'Ladro', 'Monaco', 'Paladino', 'Ranger', 'Stregone', 'Warlock', 'Mago'];
    expect(new Set(names.map(classRgb)).size).toBe(12);
  });

  it('falls back to gold for an unknown or empty class', () => {
    expect(classRgb('Artefice')).toBe(DEFAULT_CLASS_RGB);
    expect(classRgb('')).toBe(DEFAULT_CLASS_RGB);
  });

  it('is always a valid "r g b" triple', () => {
    for (const n of ['Mago', 'Barbaro', 'x']) expect(classRgb(n)).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
  });
});
