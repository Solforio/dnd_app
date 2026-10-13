import { describe, expect, it } from 'vitest';
import { apply, axisAngle, dot, easeOutCubic, FACES, faceToViewer, hash, multiply, VERTICES } from './d20geometry';

describe('d20 geometry', () => {
  it('has 12 vertices on the unit sphere and 20 faces numbered 1 to 20', () => {
    expect(VERTICES).toHaveLength(12);
    VERTICES.forEach((v) => expect(Math.hypot(...v)).toBeCloseTo(1));
    expect(FACES).toHaveLength(20);
    expect(FACES.map((f) => f.value).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('puts opposite faces adding up to 21', () => {
    for (const f of FACES) {
      const opposite = FACES.find((g) => dot(g.normal, f.normal) < -0.999)!;
      expect(f.value + opposite.value).toBe(21);
    }
  });

  it('turns any face towards the viewer, upright', () => {
    for (const f of FACES) {
      const r = faceToViewer(f);
      const n = apply(r, f.normal);
      expect(n[2]).toBeCloseTo(1);
      const top = apply(r, VERTICES[f.v[0]]!);
      expect(Math.abs(top[0])).toBeLessThan(1e-9); // straight above the centre
      expect(top[1]).toBeGreaterThan(0);
    }
  });

  it('builds proper rotations', () => {
    const r = multiply(axisAngle([0, 0, 1], Math.PI / 2), axisAngle([1, 0, 0], 0.3));
    const v = apply(r, [1, 0, 0]);
    expect(v[0]).toBeCloseTo(0);
    expect(v[1]).toBeCloseTo(1);
    expect(Math.hypot(...apply(r, [0.3, -0.4, 0.5]))).toBeCloseTo(Math.hypot(0.3, -0.4, 0.5));
  });

  it('eases and hashes', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(hash('a')).not.toBe(hash('b'));
    expect(hash('roll-1')).toBe(hash('roll-1'));
  });
});
