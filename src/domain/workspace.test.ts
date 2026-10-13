import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import { addAndSelect, CHARACTER_LIMIT, duplicate, isFull, removeFrom, selectIn, type Workspace } from './workspace';

function workspace(...names: string[]): Workspace {
  const [first, ...rest] = names.map((n) => ({ ...createCharacter(n), id: n }));
  return { character: first!, others: rest };
}

const ids = (w: Workspace) => [w.character.id, ...w.others.map((c) => c.id)];

describe('workspace', () => {
  it('selects another character and keeps every one', () => {
    const w = selectIn(workspace('a', 'b', 'c'), 'c');
    expect(ids(w)).toEqual(['c', 'a', 'b']);
    expect(selectIn(w, 'missing')).toBe(w);
  });

  it('adds a new character as active, replacing one with the same id', () => {
    const w = workspace('a', 'b');
    expect(ids(addAndSelect(w, { ...createCharacter('Nuovo'), id: 'n' }))).toEqual(['n', 'a', 'b']);
    const replaced = addAndSelect(w, { ...createCharacter('B bis'), id: 'b' });
    expect(ids(replaced)).toEqual(['b', 'a']);
    expect(replaced.character.name).toBe('B bis');
  });

  it('duplicates with a new id and no history', () => {
    const c = createCharacter('Thorin');
    c.sheet.abilities.str = 18;
    c.history = [{ id: 'r', formula: '1d20', mode: 'normal', terms: [], total: 3, crit: false, fumble: false, at: 1 }];
    const copy = duplicate(c, 'new', 5);
    expect(copy).toMatchObject({ id: 'new', name: 'Thorin (copia)', history: [], updatedAt: 5 });
    expect(copy.sheet.abilities.str).toBe(18);
    copy.sheet.abilities.str = 3;
    expect(c.sheet.abilities.str).toBe(18); // deep copy
  });

  it('removes a character, moving to the next one when it was active', () => {
    expect(ids(removeFrom(workspace('a', 'b', 'c'), 'b'))).toEqual(['a', 'c']);
    expect(ids(removeFrom(workspace('a', 'b', 'c'), 'a'))).toEqual(['b', 'c']);
  });

  it('leaves a fresh character after removing the last one', () => {
    const w = removeFrom(workspace('a'), 'a');
    expect(w.others).toEqual([]);
    expect(w.character.id).not.toBe('a');
  });

  it('knows when the limit is reached', () => {
    const names = Array.from({ length: CHARACTER_LIMIT }, (_, i) => `c${i}`);
    expect(isFull(workspace(...names))).toBe(true);
    expect(isFull(workspace(...names.slice(1)))).toBe(false);
  });
});
