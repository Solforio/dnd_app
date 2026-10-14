import { describe, expect, it } from 'vitest';
import { apply, dot } from './d20geometry';
import { faceToViewerOf, SOLID_SIDES, solidFor } from './solids';

const SHAPE: Record<number, { vertices: number; faceSize: number }> = {
  4: { vertices: 4, faceSize: 3 },
  6: { vertices: 8, faceSize: 4 },
  8: { vertices: 6, faceSize: 3 },
  10: { vertices: 12, faceSize: 4 },
  12: { vertices: 20, faceSize: 5 },
  20: { vertices: 12, faceSize: 3 },
};

describe('dice solids', () => {
  for (const sides of SOLID_SIDES) {
    describe(`d${sides}`, () => {
      const solid = solidFor(sides);

      it('has the right shape, inside the unit sphere', () => {
        expect(solid.vertices).toHaveLength(SHAPE[sides]!.vertices);
        expect(solid.faces).toHaveLength(sides);
        for (const f of solid.faces) expect(f.v).toHaveLength(SHAPE[sides]!.faceSize);
        const radii = solid.vertices.map((v) => Math.hypot(...v));
        expect(Math.max(...radii)).toBeCloseTo(1);
        expect(Math.min(...radii)).toBeGreaterThan(0.9);
      });

      it('has flat faces with outward normals, and a convex solid', () => {
        for (const f of solid.faces) {
          const heights = f.v.map((i) => dot(solid.vertices[i]!, f.normal));
          heights.forEach((h) => expect(h).toBeCloseTo(heights[0]!, 6));
          expect(heights[0]).toBeGreaterThan(0);
          // No vertex sticks out past the face plane.
          for (const p of solid.vertices) expect(dot(p, f.normal)).toBeLessThanOrEqual(heights[0]! + 1e-6);
        }
      });

      it('numbers the faces 1 to n, opposite faces adding up to n + 1', () => {
        expect(solid.faces.map((f) => f.value).sort((a, b) => a - b)).toEqual(Array.from({ length: sides }, (_, i) => i + 1));
        if (sides === 4) return;
        for (const f of solid.faces) {
          const opposite = solid.faces.find((g) => dot(g.normal, f.normal) < -0.999)!;
          expect(f.value + opposite.value).toBe(sides + 1);
        }
      });

      it('turns any face towards the viewer, upright', () => {
        for (const f of solid.faces) {
          const n = apply(faceToViewerOf(solid, f), f.normal);
          expect(n[2]).toBeCloseTo(1);
        }
      });
    });
  }

  it('draws a d100 as a d10 and unusual dice as a d20', () => {
    expect(solidFor(100).sides).toBe(10);
    expect(solidFor(3).sides).toBe(20);
    expect(solidFor(7).sides).toBe(20);
  });
});
