import { describe, expect, it } from 'vitest';
import { parseFormula } from './parser';

function ok(input: string) {
  const r = parseFormula(input);
  if (!r.ok) throw new Error(`expected ${input} to parse: ${r.error}`);
  return r.formula;
}

function err(input: string) {
  const r = parseFormula(input);
  if (r.ok) throw new Error(`expected ${input} to fail`);
  return r.error;
}

describe('parseFormula', () => {
  it('parses a single die with a modifier and canonicalises the count', () => {
    const f = ok('d20+5');
    expect(f.text).toBe('1d20+5');
    expect(f.terms).toEqual([
      { type: 'dice', sign: 1, count: 1, sides: 20 },
      { type: 'flat', sign: 1, value: 5 },
    ]);
  });

  it('parses several dice terms and subtraction', () => {
    expect(ok('2d6+1d4+3').text).toBe('2d6+1d4+3');
    expect(ok('1d8-1').terms[1]).toEqual({ type: 'flat', sign: -1, value: 1 });
    expect(ok('-2+d4').text).toBe('-2+1d4');
  });

  it('ignores whitespace and case', () => {
    expect(ok('  2 D6 + 4D6KH3 ').text).toBe('2d6+4d6kh3');
  });

  it('parses keep and drop suffixes, defaulting the count to 1', () => {
    expect(ok('4d6kh3').terms[0]).toMatchObject({ keepDrop: { kind: 'kh', count: 3 } });
    expect(ok('2d20kl').terms[0]).toMatchObject({ keepDrop: { kind: 'kl', count: 1 } });
    expect(ok('4d6dl').terms[0]).toMatchObject({ keepDrop: { kind: 'dl', count: 1 } });
    expect(ok('3d8dh2').terms[0]).toMatchObject({ keepDrop: { kind: 'dh', count: 2 } });
  });

  it('accepts the limits and rejects values beyond them', () => {
    expect(parseFormula('100d1000').ok).toBe(true);
    expect(parseFormula('1d2').ok).toBe(true);
    expect(err('101d6')).toMatch(/tra 1 e 100/);
    expect(err('0d6')).toMatch(/tra 1 e 100/);
    expect(err('1d1')).toMatch(/tra 2 e 1000/);
    expect(err('1d1001')).toMatch(/tra 2 e 1000/);
  });

  it('rejects impossible keep and drop counts', () => {
    expect(err('4d6kh5')).toMatch(/tenere da 1 a 4/);
    expect(err('4d6kh0')).toMatch(/tenere da 1 a 4/);
    expect(err('4d6dl4')).toMatch(/scartare da 1 a 3/);
    expect(err('1d20dl')).toMatch(/unico dado/);
  });

  it('gives an Italian message with examples for malformed input', () => {
    for (const bad of ['', '   ', 'abc', 'd20+', '++2', 'd', '2d', 'd20x2', '1.5', 'd20*2']) {
      const e = err(bad);
      expect(e).toMatch(/Esempi validi: d20\+5, 2d6\+1d4\+3, 4d6kh3\./);
    }
    expect(err('d20+abc')).toMatch(/Non capisco «abc»/);
  });
});
