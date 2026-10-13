/**
 * Geometry of a d20 (regular icosahedron) for the 3D roll animation: plain
 * math, no rendering. Coordinates: x right, y up, z towards the viewer.
 */

export type Vec3 = readonly [number, number, number];
/** Row-major 3×3 rotation matrix. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

const PHI = (1 + Math.sqrt(5)) / 2;
const CIRCUMRADIUS = Math.sqrt(1 + PHI * PHI);

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
}

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const col = (j: 0 | 1 | 2): Vec3 => [b[0][j], b[1][j], b[2][j]];
  const row = (r: Vec3): Vec3 => [dot(r, col(0)), dot(r, col(1)), dot(r, col(2))];
  return [row(a[0]), row(a[1]), row(a[2])];
}

/** Rotation by `angle` radians around the unit vector `axis` (Rodrigues). */
export function axisAngle(axis: Vec3, angle: number): Mat3 {
  const [x, y, z] = axis;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

/** The 12 vertices, scaled so the die fits in the unit sphere. */
export const VERTICES: readonly Vec3[] = (
  [
    [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
    [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
    [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
  ] as Vec3[]
).map((v) => scale(v, 1 / CIRCUMRADIUS));

export interface Face {
  /** Vertex indices, counter-clockwise seen from outside. */
  v: readonly [number, number, number];
  /** Outward unit normal (also the centroid direction). */
  normal: Vec3;
  centroid: Vec3;
  /** The number printed on this face, 1 to 20. */
  value: number;
}

/** Every triple of mutually adjacent vertices is a face: there are exactly 20. */
function buildFaces(): Face[] {
  const edge = Math.hypot(...sub(VERTICES[0]!, VERTICES[1]!));
  const adjacent = (a: number, b: number) => Math.abs(Math.hypot(...sub(VERTICES[a]!, VERTICES[b]!)) - edge) < 1e-9;
  const faces: Face[] = [];
  for (let a = 0; a < 12; a++)
    for (let b = a + 1; b < 12; b++)
      for (let c = b + 1; c < 12; c++) {
        if (!adjacent(a, b) || !adjacent(b, c) || !adjacent(a, c)) continue;
        const [A, B, C] = [VERTICES[a]!, VERTICES[b]!, VERTICES[c]!];
        const centroid = scale([A[0] + B[0] + C[0], A[1] + B[1] + C[1], A[2] + B[2] + C[2]], 1 / 3);
        const n = cross(sub(B, A), sub(C, A));
        const outward = dot(n, centroid) > 0;
        faces.push({ v: outward ? [a, b, c] : [a, c, b], normal: normalize(centroid), centroid, value: 0 });
      }
  // Opposite faces add up to 21, as on a real d20.
  const values = new Map<Face, number>();
  let next = 1;
  for (const f of faces) {
    if (values.has(f)) continue;
    const opposite = faces.find((g) => dot(g.normal, f.normal) < -0.999)!;
    values.set(f, next);
    values.set(opposite, 21 - next);
    next += 1;
  }
  return faces.map((f) => ({ ...f, value: values.get(f)! }));
}

export const FACES: readonly Face[] = buildFaces();

/**
 * The rotation that turns `face` towards the viewer (normal → +z) with one of
 * its vertices pointing up, so the number on it reads upright.
 */
export function faceToViewer(face: Face): Mat3 {
  const z = face.normal;
  const toVertex = sub(VERTICES[face.v[0]]!, face.centroid);
  const y = normalize(sub(toVertex, scale(z, dot(toVertex, z))));
  const x = cross(y, z);
  return [x, y, z];
}

/** Easing that starts fast and settles: the die slows down as it lands. */
export function easeOutCubic(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t));
  return 1 - u * u * u;
}

/** Small deterministic hash (FNV-1a), so each roll tumbles its own way without Math.random. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
