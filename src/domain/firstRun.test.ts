import { describe, expect, it } from 'vitest';
import { defaultSheet } from './sheet/sheet';
import { sheetFromFirstRun, startingHp } from './firstRun';

describe('startingHp', () => {
  it('gives the full die at level 1 plus the Constitution modifier', () => {
    expect(startingHp('Guerriero', 1, 14)).toBe(12); // d10 + 2
    expect(startingHp('Mago', 1, 10)).toBe(6); // d6 + 0
  });

  it('adds the fixed value of the die for each further level', () => {
    expect(startingHp('Guerriero', 3, 14)).toBe(12 + 2 * (6 + 2)); // 28
    expect(startingHp('Barbaro', 2, 16)).toBe(15 + (7 + 3)); // d12: 12+3, then 7+3
  });

  it('never gives less than 1 HP a level, and falls back to a d8 for an unknown class', () => {
    expect(startingHp('Mago', 2, 3)).toBe(2 + 1); // d6 −4: 2 at level 1, then 4 − 4 raised to 1
    expect(startingHp('Cantastorie', 1, 10)).toBe(8);
  });

  it('keeps the level inside 1 to 20', () => {
    expect(startingHp('Mago', 0, 10)).toBe(6);
    expect(startingHp('Mago', 99, 10)).toBe(startingHp('Mago', 20, 10));
  });
});

describe('sheetFromFirstRun', () => {
  const abilities = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };

  it('sets the class, the level and the scores, and leaves the rest of the sheet alone', () => {
    const s = sheetFromFirstRun({ className: ' Mago ', level: 3, abilities });
    expect(s.classes).toEqual([{ name: 'Mago', subclass: '', level: 3, hitDie: 0, hitDiceUsed: 0 }]);
    expect(s.abilities).toEqual(abilities);
    expect(s.ac).toBe(defaultSheet().ac);
  });

  it('keeps the default class list when no class is typed, and clamps wild numbers', () => {
    const s = sheetFromFirstRun({ className: '  ', level: 400, abilities: { ...abilities, str: 999, dex: -4 } });
    expect(s.classes).toEqual(defaultSheet().classes);
    expect(s.abilities.str).toBe(30);
    expect(s.abilities.dex).toBe(1);
  });
});
