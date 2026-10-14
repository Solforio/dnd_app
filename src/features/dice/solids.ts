/**
 * The seven dice as solids for the 3D roll animation: plain math, no
 * rendering. The d20 comes from `d20geometry`; here are the others. A d100 is
 * drawn as a d10. Every solid fits in the unit sphere.
 */
import { cross, dot, FACES, normalize, VERTICES, type Face, type Mat3, type Vec3 } from './d20geometry';

export const SOLID_SIDES = [4, 6, 8, 10, 12, 20] as const;
export type SolidSides = (typeof SOLID_SIDES)[number];

export interface Solid {
  sides: SolidSides;
  vertices: readonly Vec3[];
  faces: readonly Face[];
  /** Size of the small numbers on the faces that are not in front. */
  labelSize: number;
  /** Multiplier for the total shown on the front face (the faces differ in size). */
  textScale: number;
}

const PHI = (1 + Math.sqrt(5)) / 2;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const mean = (pts: readonly Vec3[]): Vec3 =>
  scale(
    pts.reduce<Vec3>((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]),
    1 / pts.length,
  );

/** Scales the points so the farthest one is on the unit sphere. */
function toUnitSphere(points: readonly Vec3[]): Vec3[] {
  const radius = Math.max(...points.map((p) => Math.hypot(...p)));
  return points.map((p) => scale(p, 1 / radius));
}

/** Signs of every combination, e.g. [±a, ±b, ±c]. */
function signed(a: number, b: number, c: number): Vec3[] {
  const out: Vec3[] = [];
  for (const sa of a === 0 ? [1] : [1, -1])
    for (const sb of b === 0 ? [1] : [1, -1])
      for (const sc of c === 0 ? [1] : [1, -1]) out.push([sa * a, sb * b, sc * c]);
  return out;
}

/** The vertices of one face, ordered counter-clockwise seen from outside. */
function faceOf(vertices: readonly Vec3[], group: readonly number[]): Pick<Face, 'v' | 'normal' | 'centroid'> {
  const centroid = mean(group.map((i) => vertices[i]!));
  const axis = normalize(centroid);
  const helper: Vec3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(helper, axis));
  const w = cross(axis, u);
  const angle = (i: number) => {
    const p = sub(vertices[i]!, centroid);
    return Math.atan2(dot(p, w), dot(p, u));
  };
  const v = [...group].sort((a, b) => angle(a) - angle(b));
  const [a, b, c] = [vertices[v[0]!]!, vertices[v[1]!]!, vertices[v[2]!]!];
  return { v, centroid, normal: normalize(cross(sub(b, a), sub(c, a))) };
}

/** Indices of the vertices lying on the face with the given outward normal. */
function onFace(vertices: readonly Vec3[], normal: Vec3): number[] {
  const heights = vertices.map((p) => dot(p, normal));
  const top = Math.max(...heights);
  return heights.flatMap((h, i) => (h > top - 1e-6 ? [i] : []));
}

/** Numbers the faces: opposite faces add up to sides + 1 (a d4 has no opposite face). */
function numberFaces(sides: SolidSides, faces: Omit<Face, 'value'>[]): Face[] {
  if (sides === 4) return faces.map((f, i) => ({ ...f, value: i + 1 }));
  const values = new Map<Omit<Face, 'value'>, number>();
  let next = 1;
  for (const f of faces) {
    if (values.has(f)) continue;
    const opposite = faces.find((g) => dot(g.normal, f.normal) < -0.999)!;
    values.set(f, next);
    values.set(opposite, sides + 1 - next);
    next += 1;
  }
  return faces.map((f) => ({ ...f, value: values.get(f)! }));
}

function build(
  sides: SolidSides,
  vertices: Vec3[],
  groups: number[][],
  labelSize: number,
  textScale: number,
): Solid {
  const faces = numberFaces(
    sides,
    groups.map((g) => faceOf(vertices, g)),
  );
  return { sides, vertices, faces, labelSize, textScale };
}

function tetrahedron(): Solid {
  const vertices = toUnitSphere([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]);
  // Each face is opposite a vertex.
  return build(4, vertices, vertices.map((v) => onFace(vertices, scale(v, -1))), 26, 1);
}

function cube(): Solid {
  const vertices = toUnitSphere(signed(1, 1, 1));
  const axes: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  return build(6, vertices, axes.map((n) => onFace(vertices, n)), 24, 1.1);
}

function octahedron(): Solid {
  const vertices: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  return build(8, vertices, signed(1, 1, 1).map((n) => onFace(vertices, n)), 20, 0.9);
}

/** Pentagonal trapezohedron: ten kite faces, planar by construction. */
function trapezohedron(): Solid {
  const a = 0.105;
  const c = Math.cos(Math.PI / 5);
  const apex = (a * (1 + c)) / (1 - c);
  const ring = (k: number): number => 2 + ((k + 10) % 10);
  const raw: Vec3[] = [[0, 0, apex], [0, 0, -apex]];
  for (let k = 0; k < 10; k++) {
    const t = (k * Math.PI) / 5;
    raw.push([Math.cos(t), Math.sin(t), k % 2 === 0 ? -a : a]);
  }
  const groups: number[][] = [];
  for (let k = 0; k < 10; k++) groups.push([k % 2 === 0 ? 0 : 1, ring(k - 1), ring(k), ring(k + 1)]);
  return build(10, toUnitSphere(raw), groups, 14, 0.7);
}

function dodecahedron(): Solid {
  const g = 1 / PHI;
  const vertices = toUnitSphere([
    ...signed(1, 1, 1),
    ...signed(0, g, PHI),
    ...signed(g, PHI, 0),
    ...signed(PHI, 0, g),
  ]);
  const normals: Vec3[] = [...signed(0, PHI, 1), ...signed(PHI, 1, 0), ...signed(1, 0, PHI)];
  return build(12, vertices, normals.map((n) => onFace(vertices, normalize(n))), 16, 1);
}

const icosahedron = (): Solid => ({ sides: 20, vertices: VERTICES, faces: FACES, labelSize: 15, textScale: 1 });

const builders: Record<SolidSides, () => Solid> = {
  4: tetrahedron,
  6: cube,
  8: octahedron,
  10: trapezohedron,
  12: dodecahedron,
  20: icosahedron,
};
const cache = new Map<SolidSides, Solid>();

/** The solid drawn for a die; the d100 is a d10 and any unusual die falls back to the d20. */
export function solidFor(sides: number): Solid {
  const key: SolidSides = sides === 100 ? 10 : (SOLID_SIDES as readonly number[]).includes(sides) ? (sides as SolidSides) : 20;
  let solid = cache.get(key);
  if (!solid) {
    solid = builders[key]();
    cache.set(key, solid);
  }
  return solid;
}

/**
 * The rotation that turns `face` towards the viewer (normal → +z) with a
 * vertex pointing up (the long tip of a d10 kite, an edge on the cube so the square sits flat).
 */
export function faceToViewerOf(solid: Solid, face: Face): Mat3 {
  const z = face.normal;
  const corners = face.v.map((i) => solid.vertices[i]!);
  const first = corners[0]!;
  // A kite stands on its long axis (the farthest corner up); a square on an edge; the rest on a corner.
  const farthest = corners.reduce((best, p) => (Math.hypot(...sub(p, face.centroid)) > Math.hypot(...sub(best, face.centroid)) + 1e-9 ? p : best), first);
  const target = solid.sides === 6 ? mean([first, corners[1]!]) : solid.sides === 10 ? farthest : first;
  const toTarget = sub(target, face.centroid);
  const y = normalize(sub(toTarget, scale(z, dot(toTarget, z))));
  const x = cross(y, z);
  return [x, y, z];
}
