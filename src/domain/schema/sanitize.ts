/** Small helpers that coerce untrusted values (storage, imports, shared data) into safe ones. */

export function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function asInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function asString(v: unknown, maxLength: number, fallback = ''): string {
  return typeof v === 'string' ? v.slice(0, maxLength) : fallback;
}

export function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function asOneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function asArray(v: unknown, maxLength: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, maxLength) : [];
}
