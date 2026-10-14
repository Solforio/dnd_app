import { useEffect, useState } from 'react';
import { apply, axisAngle, dot, easeOutCubic, hash, multiply, normalize, type Mat3, type Vec3 } from './d20geometry';
import { diceMotionOn, useDiceMotion } from '../../data/motionPref';
import { faceToViewerOf, solidFor } from './solids';

const DURATION_MS = 1100;
const LIGHT = normalize([-0.45, 0.65, 1]);
const DARK_RGB = [34, 32, 58];
const LIT_RGB = [96, 90, 150];
/** Mild perspective: the camera sits 4 radii away. */
const CAMERA = 4;

function project(v: Vec3): [number, number] {
  const k = CAMERA / (CAMERA - v[2]);
  return [100 + v[0] * 86 * k, 100 - v[1] * 86 * k];
}

function shade(lambert: number): string {
  const mix = (i: number) => Math.round(DARK_RGB[i]! + (LIT_RGB[i]! - DARK_RGB[i]!) * lambert);
  return `rgb(${mix(0)} ${mix(1)} ${mix(2)})`;
}

function fontSize(text: string): number {
  if (text.length <= 2) return 40;
  if (text.length === 3) return 32;
  if (text.length <= 5) return 24;
  return 17;
}

interface Props {
  /** Changes on every roll and restarts the animation; undefined before the first roll. */
  rollId: string | undefined;
  /** What the front face shows once the die stops. */
  text: string;
  /** Sides of the die drawn: the first dice term of the roll (a d100 is drawn as a d10). Default d20. */
  sides?: number;
  /** The natural roll of that die, when there is exactly one: that face ends up in front. */
  natural?: number;
  className: string;
  label: string;
  /** When given, the die is a button: a tap rolls again. */
  onRoll?: () => void;
  /** What the button announces, e.g. «Lancia 1d20». */
  rollLabel?: string;
}

/**
 * The memorable element: a real icosahedron, rotated and projected into SVG
 * every frame. It tumbles, bounces and settles with the result towards the
 * viewer. With reduced motion it simply appears in its final position.
 */
export function Die3D({ rollId, text, sides = 20, natural, className, label, onRoll, rollLabel }: Props) {
  const solid = solidFor(sides);
  // Progress of the animation for one roll id; a new id starts again from 0.
  const [anim, setAnim] = useState<{ id: string | undefined; t: number }>({ id: rollId, t: 1 });
  // The roll already on screen when the page opens does not tumble again.
  const [mountedWith] = useState(rollId);
  const motion = useDiceMotion((s) => s.mode);
  const animate = rollId !== undefined && rollId !== mountedWith && diceMotionOn(motion);
  const progress = !animate ? 1 : anim.id === rollId ? anim.t : 0;

  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      setAnim({ id: rollId, t });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rollId, animate]);

  const seed = hash(rollId ?? 'idle');
  const target = solid.faces.find((f) => f.value === natural) ?? solid.faces[seed % solid.faces.length]!;
  const upright = faceToViewerOf(solid, target);
  // The d4 and d6 would look like flat shapes face-on: rest them slightly tilted so the sides show.
  const final: Mat3 = solid.sides <= 6 ? multiply(axisAngle(normalize([1, 0.7, 0]), -0.35), upright) : upright;
  // Before the first roll the die rests slightly turned, so it reads as a solid.
  const idle: Mat3 = multiply(axisAngle(normalize([1, 0.4, 0]), -0.35), final);

  const eased = easeOutCubic(progress);
  const axis = normalize([Math.sin(seed), Math.cos(seed * 1.3), 0.6]);
  const spin = 4 * Math.PI + ((seed % 1000) / 1000) * 2 * Math.PI;
  const rotation: Mat3 = rollId ? multiply(final, axisAngle(axis, (1 - eased) * spin)) : idle;
  // A couple of bounces that shrink as it lands.
  const lift = (1 - progress) * 34 * Math.abs(Math.cos(progress * 3 * Math.PI));
  const settled = progress >= 1;

  const points = solid.vertices.map((v) => apply(rotation, v));
  const visible = solid.faces.map((f) => ({ f, n: apply(rotation, f.normal), c: apply(rotation, f.centroid) }))
    .filter((x) => x.n[2] > 0.01)
    .sort((a, b) => a.c[2] - b.c[2]);

  const svg = (
    <svg className={`d20 die3d d${solid.sides}${className}`} viewBox="0 0 200 200" role="img" aria-label={label}>
      <g transform={`translate(0 ${-lift})`}>
        {visible.map(({ f, n, c }) => {
          const poly = f.v.map((i) => project(points[i]!).join(',')).join(' ');
          const [cx, cy] = project(c);
          const front = settled && f === target;
          const value = front ? text : String(f.value);
          return (
            <g key={f.value}>
              <polygon className="face" points={poly} style={{ fill: shade(Math.max(0, dot(n, LIGHT))) }} />
              <text
                className={front ? 'total' : 'face-number'}
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={front ? fontSize(value) * solid.textScale : solid.labelSize * n[2]}
                opacity={front ? 1 : settled ? 0.3 * n[2] : 0.85 * n[2]}
              >
                {value}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );

  if (!onRoll) return svg;
  return (
    <button type="button" className="die-button" onClick={onRoll} aria-label={rollLabel ?? 'Lancia'}>
      {svg}
    </button>
  );
}
