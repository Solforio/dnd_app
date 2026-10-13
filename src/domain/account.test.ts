import { describe, expect, it } from 'vitest';
import { emailToUsername, usernameToEmail, validatePassword, validateUsername } from './account';

describe('validateUsername', () => {
  it('normalizes case and surrounding spaces', () => {
    expect(validateUsername('  Thalia_92 ')).toEqual({ ok: true, value: 'thalia_92' });
  });

  it('accepts letters, digits, _ and - within 3 to 20 characters', () => {
    expect(validateUsername('abc').ok).toBe(true);
    expect(validateUsername('a-b_c-1234567890abcd').ok).toBe(true);
  });

  it('rejects wrong lengths with the current count', () => {
    expect(validateUsername('ab')).toEqual({ ok: false, error: expect.stringMatching(/da 3 a 20.*ora ne ha 2/) });
    expect(validateUsername('a'.repeat(21)).ok).toBe(false);
    expect(validateUsername('   ')).toEqual({ ok: false, error: 'Scrivi un nome utente.' });
  });

  it('rejects spaces, accents and symbols', () => {
    for (const bad of ['mario rossi', 'niccolò', 'a@b', 'x.y', 'ciao!']) {
      expect(validateUsername(bad)).toEqual({ ok: false, error: expect.stringMatching(/solo lettere/) });
    }
  });
});

describe('validatePassword', () => {
  it('only asks for the Firebase minimum', () => {
    expect(validatePassword('123456').ok).toBe(true);
    expect(validatePassword('12345')).toEqual({ ok: false, error: expect.stringMatching(/almeno 6/) });
  });
});

describe('synthetic email', () => {
  it('round-trips the username', () => {
    expect(usernameToEmail(' Thalia ')).toBe('thalia@dnd.local');
    expect(emailToUsername('thalia@dnd.local')).toBe('thalia');
    expect(emailToUsername(null)).toBe('');
  });
});
