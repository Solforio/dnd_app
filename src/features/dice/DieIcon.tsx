import { apply, axisAngle, dot, multiply, normalize, type Mat3, type Vec3 } from './d20geometry';
import { faceToViewerOf, solidFor, type Solid } from './solids';

const LIGHT = normalize([-0.45, 0.65, 1]);

interface Shape {
  polys: { points: string; light: number }[];
}

const shapes = new Map<number, Shape>();

/** A fixed three-quarter view of the die, so every icon is the same solid used by the 3D roll. */
function shapeOf(solid: Solid): Shape {
  let shape = shapes.get(solid.sides);
  if (shape) return shape;
  const view: Mat3 = multiply(
    axisAngle([0, 1, 0], 0.55),
    multiply(axisAngle([1, 0, 0], -0.45), faceToViewerOf(solid, solid.faces[0]!)),
  );
  const pts = solid.vertices.map((v) => apply(view, v));
  const project = (v: Vec3) => `${(24 + v[0] * 21).toFixed(1)},${(24 - v[1] * 21).toFixed(1)}`;
  const polys = solid.faces
    .map((f) => ({ f, n: apply(view, f.normal), c: apply(view, f.centroid) }))
    .filter((x) => x.n[2] > 0.02)
    .sort((a, b) => a.c[2] - b.c[2])
    .map(({ f, n }) => ({ points: f.v.map((i) => project(pts[i]!)).join(' '), light: Math.max(0, dot(n, LIGHT)) }));
  shape = { polys };
  shapes.set(solid.sides, shape);
  return shape;
}

/** The outline of a die (d100 is drawn as a d10), tinted with the surrounding text colour. Decorative. */
export function DieIcon({ sides, size = 40, className = 'die-icon' }: { sides: number; size?: number; className?: string }) {
  const shape = shapeOf(solidFor(sides));
  return (
    <svg className={className} viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      {shape.polys.map((p, i) => (
        <polygon key={i} points={p.points} fillOpacity={0.12 + 0.5 * p.light} />
      ))}
    </svg>
  );
}
