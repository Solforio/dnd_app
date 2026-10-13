import { describe, expect, it } from 'vitest';
import { formatNumber, formatSigned } from './number';

describe('formatNumber', () => {
  it('uses a comma for decimals and a period for thousands, four digits included', () => {
    expect(formatNumber(12.5, 1)).toBe('12,5');
    expect(formatNumber(1250)).toBe('1.250');
    expect(formatNumber(1234567.891, 2)).toBe('1.234.567,89');
    expect(formatNumber(999)).toBe('999');
  });

  it('drops trailing zeros and rounds to the requested decimals', () => {
    expect(formatNumber(2, 2)).toBe('2');
    expect(formatNumber(2.456, 1)).toBe('2,5');
  });

  it('formats negatives and signs', () => {
    expect(formatNumber(-1250)).toBe('−1.250');
    expect(formatSigned(5)).toBe('+5');
    expect(formatSigned(-2)).toBe('−2');
    expect(formatSigned(0)).toBe('0');
  });
});
