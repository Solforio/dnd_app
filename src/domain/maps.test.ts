import { describe, expect, it } from 'vitest';
import {
  breadcrumb,
  canNest,
  centreOn,
  clampView,
  downscaleTarget,
  fitView,
  mapTree,
  nameFromFile,
  sanitizeMap,
  sanitizePersonalMap,
  sanitizePin,
  toImageFraction,
  toScreen,
  zoomAt,
  type GameMap,
} from './maps';

const map = (id: string, parentId: string | null = null, name = id): GameMap => ({
  id,
  name,
  parentId,
  fingerprint: 'a'.repeat(32),
  width: 4000,
  height: 3000,
  createdAt: 0,
  updatedAt: 0,
});

describe('hierarchy', () => {
  const maps = [map('faerun', null, 'Faerûn'), map('coast', 'faerun', 'Costa della Spada'), map('wd', 'coast', 'Waterdeep'), map('bg', 'coast', 'Baldur’s Gate'), map('chult', null, 'Chult')];

  it('builds the breadcrumb from the top', () => {
    expect(breadcrumb(maps, 'wd').map((m) => m.id)).toEqual(['faerun', 'coast', 'wd']);
    expect(breadcrumb(maps, 'missing')).toEqual([]);
  });

  it('refuses loops', () => {
    expect(canNest(maps, 'faerun', 'wd')).toBe(false);
    expect(canNest(maps, 'wd', 'wd')).toBe(false);
    expect(canNest(maps, 'chult', 'faerun')).toBe(true);
    expect(canNest(maps, 'wd', null)).toBe(true);
  });

  it('survives a loop already in the data', () => {
    const looped = [map('a', 'b'), map('b', 'a')];
    expect(breadcrumb(looped, 'a').map((m) => m.id)).toEqual(['b', 'a']);
    expect(mapTree(looped).map((t) => t.map.id)).toEqual(['a', 'b']);
  });

  it('lists maps as an indented tree, alphabetical per level', () => {
    expect(mapTree(maps).map(({ map: m, depth }) => `${depth}:${m.name}`)).toEqual([
      '0:Chult',
      '0:Faerûn',
      '1:Costa della Spada',
      '2:Baldur’s Gate',
      '2:Waterdeep',
    ]);
  });

  it('puts maps with a missing parent at the top level', () => {
    expect(mapTree([map('x', 'gone')]).map((t) => t.depth)).toEqual([0]);
  });
});

describe('sanitizing', () => {
  it('clamps pins and repairs maps', () => {
    expect(sanitizePin({ x: 3, y: -1, kind: 'dragon', title: '' }, 'p1')).toMatchObject({ id: 'p1', x: 1, y: 0, kind: 'place', title: 'Segnalino', linkMapId: null });
    expect(sanitizeMap('m', { parentId: 'm', fingerprint: 'nope' })).toMatchObject({ parentId: null, fingerprint: '', name: 'Mappa' });
  });

  it('gives duplicate pin ids a new one', () => {
    let n = 0;
    const m = sanitizePersonalMap('m', { pins: [{ id: 'a' }, { id: 'a' }] }, () => `new${++n}`);
    expect(new Set(m.pins.map((p) => p.id)).size).toBe(2);
  });

  it('names maps after their file', () => {
    expect(nameFromFile('Waterdeep map-5e.jpg')).toBe('Waterdeep map 5e');
    expect(nameFromFile('Sword-Coast-Map_HighRes-Compressed.jpg')).toBe('Sword Coast Map HighRes Compressed');
  });
});

describe('pan and zoom', () => {
  const image = { width: 4000, height: 2000 };
  const port = { width: 800, height: 600 };

  it('fits and centres the whole image', () => {
    expect(fitView(image, port)).toEqual({ scale: 0.2, x: 0, y: 100 });
  });

  it('zooms around the cursor, keeping that point still', () => {
    const v = zoomAt(fitView(image, port), 2, { x: 400, y: 300 }, image, port);
    expect(v.scale).toBe(0.4);
    expect(toImageFraction(v, image, { x: 400, y: 300 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('never zooms out past the fit, nor beyond 4×', () => {
    expect(zoomAt(fitView(image, port), 0.1, { x: 0, y: 0 }, image, port).scale).toBe(0.2);
    expect(zoomAt(fitView(image, port), 1000, { x: 0, y: 0 }, image, port).scale).toBe(4);
  });

  it('keeps the image covering the viewport when panning', () => {
    const v = clampView({ scale: 1, x: 500, y: -99_999 }, image, port);
    expect(v).toEqual({ scale: 1, x: 0, y: 600 - 2000 });
  });

  it('converts between screen and image fractions', () => {
    const v = { scale: 0.5, x: -100, y: -50 };
    const p = toImageFraction(v, image, { x: 300, y: 250 });
    expect(p).toEqual({ x: 0.2, y: 0.3 });
    expect(toScreen(v, image, p)).toEqual({ x: 300, y: 250 });
  });

  it('centres on a pin', () => {
    const v = centreOn({ x: 0.5, y: 0.5 }, image, port, 1);
    expect(toScreen(v, image, { x: 0.5, y: 0.5 })).toEqual({ x: 400, y: 300 });
  });
});

describe('image size', () => {
  it('keeps normal images and scales down huge ones', () => {
    expect(downscaleTarget(8192, 5301)).toBeNull(); // Sword Coast HighRes: 43 MP, kept
    const t = downscaleTarget(13739, 11627)!; // Calimport atlas: 160 MP
    expect(t.width * t.height).toBeLessThanOrEqual(45_000_000);
    expect(t.width / t.height).toBeCloseTo(13739 / 11627, 2);
    expect(downscaleTarget(20000, 1000)!.width).toBe(8192);
  });
});
