import { asArray, asInt, asOneOf, asRecord, asString } from './schema/sanitize';

/**
 * Maps: the image stays in the browser (copyright, and no Cloud Storage on
 * Spark); documents keep the name, the hierarchy (sub-maps), a fingerprint of
 * the image and the pins, whose coordinates are fractions (0..1) of the image.
 */

export const MAP_SCHEMA_VERSION = 1;
/** Soft limits, enforced in the UI. */
export const MAP_LIMIT = 30;
export const PIN_LIMIT = 300;
export const TEXT = { mapName: 60, pinTitle: 80, pinNote: 1000 } as const;

export const PIN_KINDS = ['place', 'city', 'quest', 'danger', 'note'] as const;
export type PinKind = (typeof PIN_KINDS)[number];
export const PIN_KIND_LABELS: Readonly<Record<PinKind, string>> = {
  place: 'Luogo',
  city: 'Città',
  quest: 'Missione',
  danger: 'Pericolo',
  note: 'Nota',
};

export interface MapPin {
  id: string;
  /** Fractions of the image width and height, 0..1. */
  x: number;
  y: number;
  title: string;
  note: string;
  kind: PinKind;
  /** A sub-map this pin opens (e.g. a city on the world map). */
  linkMapId: string | null;
  authorUid: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
}

export interface GameMap {
  id: string;
  name: string;
  /** The map this one belongs under (Faerûn › Costa della Spada › Waterdeep); null at the top. */
  parentId: string | null;
  /** SHA-256 of the original image file (hex, 32 chars): finds the image in this browser and spots a different file. */
  fingerprint: string;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

/** A personal map carries its pins inside (only its owner writes it). */
export interface PersonalMap extends GameMap {
  pins: MapPin[];
}

const time = (v: unknown) => asInt(v, 0, Number.MAX_SAFE_INTEGER, 0);

export function clamp01(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0.5;
  return Math.min(1, Math.max(0, v));
}

export function sanitizePin(raw: unknown, fallbackId: string): MapPin {
  const p = asRecord(raw);
  return {
    id: asString(p.id, 64) || fallbackId,
    x: clamp01(p.x),
    y: clamp01(p.y),
    title: asString(p.title, TEXT.pinTitle) || 'Segnalino',
    note: asString(p.note, TEXT.pinNote),
    kind: asOneOf(p.kind, PIN_KINDS, 'place'),
    linkMapId: asString(p.linkMapId, 64) || null,
    authorUid: asString(p.authorUid, 128),
    authorName: asString(p.authorName, 20),
    createdAt: time(p.createdAt),
    updatedAt: time(p.updatedAt),
  };
}

export function sanitizeMap(id: string, raw: unknown): GameMap {
  const m = asRecord(raw);
  const parentId = asString(m.parentId, 64) || null;
  return {
    id,
    name: asString(m.name, TEXT.mapName) || 'Mappa',
    parentId: parentId === id ? null : parentId,
    fingerprint: /^[0-9a-f]{32}$/.test(String(m.fingerprint)) ? String(m.fingerprint) : '',
    width: asInt(m.width, 1, 100_000, 1),
    height: asInt(m.height, 1, 100_000, 1),
    createdAt: time(m.createdAt),
    updatedAt: time(m.updatedAt),
  };
}

export function sanitizePersonalMap(id: string, raw: unknown, newId: () => string): PersonalMap {
  const pins = asArray(asRecord(raw).pins, PIN_LIMIT).map((p) => sanitizePin(p, newId()));
  const seen = new Set<string>();
  for (const p of pins) {
    if (seen.has(p.id)) p.id = newId();
    seen.add(p.id);
  }
  return { ...sanitizeMap(id, raw), pins };
}

// --- Hierarchy ---

/** Root first, the map itself last. Stops on missing parents and on cycles. */
export function breadcrumb<T extends GameMap>(maps: readonly T[], id: string): T[] {
  const byId = new Map(maps.map((m) => [m.id, m]));
  const chain: T[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    chain.unshift(current);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** Whether `parentId` can become the parent of `id` without creating a loop. */
export function canNest(maps: readonly GameMap[], id: string, parentId: string | null): boolean {
  if (parentId === null) return true;
  if (parentId === id) return false;
  return !breadcrumb(maps, parentId).some((m) => m.id === id);
}

/** Maps in tree order with their depth, for an indented list. Orphans (missing parent) go to the top. */
export function mapTree<T extends GameMap>(maps: readonly T[]): { map: T; depth: number }[] {
  const ids = new Set(maps.map((m) => m.id));
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'it');
  const out: { map: T; depth: number }[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const m of maps.filter((x) => (parent === null ? !x.parentId || !ids.has(x.parentId) : x.parentId === parent)).sort(byName)) {
      if (out.some((o) => o.map.id === m.id)) continue; // cycle guard
      out.push({ map: m, depth });
      visit(m.id, depth + 1);
    }
  };
  visit(null, 0);
  // Maps caught in a loop (corrupt data) would be unreachable: list them at the top.
  for (const m of maps) if (!out.some((o) => o.map.id === m.id)) out.push({ map: m, depth: 0 });
  return out;
}

/** "Waterdeep map-5e.jpg" → "Waterdeep map 5e". */
export function nameFromFile(fileName: string): string {
  return (
    fileName
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, TEXT.mapName) || 'Mappa'
  );
}

// --- Pan and zoom (pure, so the viewer stays thin) ---

/** The image's top-left corner on screen (px) and its scale (screen px per image px). */
export interface View {
  x: number;
  y: number;
  scale: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Fits the whole image in the viewport, centred. */
export function fitView(image: Size, viewport: Size): View {
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { scale, x: (viewport.width - image.width * scale) / 2, y: (viewport.height - image.height * scale) / 2 };
}

/** From "whole image visible" up to 4 screen px per image px. */
export function scaleLimits(image: Size, viewport: Size): { min: number; max: number } {
  const fit = fitView(image, viewport).scale;
  return { min: fit, max: Math.max(fit, 4) };
}

/** Keeps the image covering the viewport where it can, centred where it is smaller. */
export function clampView(v: View, image: Size, viewport: Size): View {
  const { min, max } = scaleLimits(image, viewport);
  const scale = Math.min(max, Math.max(min, v.scale));
  const w = image.width * scale;
  const h = image.height * scale;
  const axis = (pos: number, size: number, port: number) => (size <= port ? (port - size) / 2 : Math.min(0, Math.max(port - size, pos)));
  return { scale, x: axis(v.x, w, viewport.width), y: axis(v.y, h, viewport.height) };
}

/** Zooms by `factor` keeping the screen point `at` still (under the cursor or between two fingers). */
export function zoomAt(v: View, factor: number, at: { x: number; y: number }, image: Size, viewport: Size): View {
  const { min, max } = scaleLimits(image, viewport);
  const scale = Math.min(max, Math.max(min, v.scale * factor));
  const k = scale / v.scale;
  return clampView({ scale, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k }, image, viewport);
}

/** Screen point → fractions of the image (what a pin stores). */
export function toImageFraction(v: View, image: Size, point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: clamp01((point.x - v.x) / (image.width * v.scale)),
    y: clamp01((point.y - v.y) / (image.height * v.scale)),
  };
}

/** Fractions of the image → screen point. */
export function toScreen(v: View, image: Size, pin: { x: number; y: number }): { x: number; y: number } {
  return { x: v.x + pin.x * image.width * v.scale, y: v.y + pin.y * image.height * v.scale };
}

/** Puts a pin in the middle of the viewport, zoomed in at least to 1:1 (when opening a linked pin). */
export function centreOn(pin: { x: number; y: number }, image: Size, viewport: Size, scale: number): View {
  return clampView(
    { scale, x: viewport.width / 2 - pin.x * image.width * scale, y: viewport.height / 2 - pin.y * image.height * scale },
    image,
    viewport,
  );
}

// --- Image size ---

/** Largest image kept as is; bigger ones are scaled down on import so phones can show them. */
export const IMAGE_MAX_SIDE = 8192;
export const IMAGE_MAX_PIXELS = 45_000_000;

/** Target size after the downscale (same proportions), or null when the image can stay as it is. */
export function downscaleTarget(width: number, height: number): Size | null {
  const k = Math.min(1, IMAGE_MAX_SIDE / Math.max(width, height), Math.sqrt(IMAGE_MAX_PIXELS / (width * height)));
  return k >= 1 ? null : { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}
