import type { DieRoller } from './types';

const RANGE = 0x1_0000_0000; // 2^32, the range of one Uint32
const buffer = new Uint32Array(1);

/**
 * Uniform integer in [0, max) from the Web Crypto API. Values in the biased
 * tail of the 32-bit range are rejected and redrawn, so every result is
 * equally likely.
 */
export function cryptoRandomBelow(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > RANGE) {
    throw new RangeError(`max must be an integer in [1, 2^32], got ${max}`);
  }
  const limit = RANGE - (RANGE % max);
  for (;;) {
    crypto.getRandomValues(buffer);
    const x = buffer[0]!;
    if (x < limit) return x % max;
  }
}

export const cryptoDie: DieRoller = (sides) => cryptoRandomBelow(sides) + 1;
