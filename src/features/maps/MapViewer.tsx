import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import {
  centreOn,
  clampView,
  fitView,
  PIN_KIND_LABELS,
  toImageFraction,
  toScreen,
  zoomAt,
  type MapPin,
  type Size,
  type View,
} from '../../domain/maps';

interface Props {
  url: string;
  image: Size;
  pins: MapPin[];
  selectedId: string | null;
  addMode: boolean;
  /** A pin to centre on when the map opens (e.g. coming back from a sub-map). */
  focusPinId?: string | null;
  onAdd: (at: { x: number; y: number }) => void;
  onSelect: (pinId: string | null) => void;
  /** Full screen: the map covers the page (and the browser's own full screen where it exists). */
  full: boolean;
  onFullChange: (full: boolean) => void;
  /** What stays reachable over the map in full screen: adding a pin and the pin being read or edited. */
  overlay?: ReactNode;
}

const CLICK_SLOP = 6;

/**
 * Pan and zoom without libraries: the image is positioned with one CSS
 * transform computed by the pure functions in domain/maps; pins are buttons
 * placed on top at their screen position, so they keep their size when zooming.
 */
export function MapViewer({ url, image, pins, selectedId, addMode, focusPinId, onAdd, onSelect, full, onFullChange, overlay }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [port, setPort] = useState<Size | null>(null);
  const [view, setView] = useState<View | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; start: { x: number; y: number }; pinch?: number } | null>(null);

  // Full screen: ask the browser for real full screen when it can (not on iPhone), keep the page from
  // scrolling behind, and leave with Escape. Leaving through the browser's own Escape ends it here too.
  useEffect(() => {
    if (!full) return;
    const el = frame.current;
    if (el?.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onFullChange(false);
    const onChange = () => {
      if (!document.fullscreenElement) onFullChange(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
      document.body.style.overflow = previous;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [full, onFullChange]);

  // Viewport size, kept up to date.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPort({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A new image or a new viewport size (first layout, phone rotation): fit it, or centre on the requested pin.
  const fitKey = `${url}|${port?.width}|${port?.height}`;
  const [fittedFor, setFittedFor] = useState('');
  if (port && fitKey !== fittedFor) {
    setFittedFor(fitKey);
    const focus = pins.find((p) => p.id === focusPinId);
    const fitted = fitView(image, port);
    setView(
      focus && fittedFor === '' ? centreOn(focus, image, port, Math.max(fitted.scale * 3, Math.min(1, fitted.scale * 6))) : fitted,
    );
  }

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const zoomBy = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      if (!port) return;
      setView((v) => (v ? zoomAt(v, factor, at ?? { x: port.width / 2, y: port.height / 2 }, image, port) : v));
    },
    [port, image],
  );

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    try {
      box.current!.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointers: panning still works without capture.
    }
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    gesture.current =
      pts.length === 2
        ? { moved: true, start: pts[0]!, pinch: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) }
        : { moved: false, start: local(e) };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !port || !gesture.current) return;
    const now = local(e);
    pointers.current.set(e.pointerId, now);
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && gesture.current.pinch) {
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const mid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
      zoomBy(dist / gesture.current.pinch, mid);
      gesture.current.pinch = dist;
      return;
    }
    if (Math.hypot(now.x - gesture.current.start.x, now.y - gesture.current.start.y) > CLICK_SLOP) gesture.current.moved = true;
    if (gesture.current.moved) {
      setView((v) => (v ? clampView({ ...v, x: v.x + now.x - prev.x, y: v.y + now.y - prev.y }, image, port) : v));
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (g && !g.moved && view) {
      if (addMode) onAdd(toImageFraction(view, image, local(e)));
      else onSelect(null);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!port || !view) return;
    const step = 60;
    const pan = (dx: number, dy: number) => setView(clampView({ ...view, x: view.x + dx, y: view.y + dy }, image, port));
    const keys: Record<string, () => void> = {
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
      '+': () => zoomBy(1.25),
      '=': () => zoomBy(1.25),
      '-': () => zoomBy(0.8),
      '0': () => setView(fitView(image, port)),
    };
    const action = keys[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  return (
    <div ref={frame} className={`map-frame${full ? ' full' : ''}`}>
      <div
        ref={box}
        className={`map-viewport${addMode ? ' adding' : ''}`}
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
        tabIndex={0}
        role="application"
        aria-label="Mappa: trascina per spostarti, rotella o due dita per lo zoom. Da tastiera: frecce, + e −, 0 per vederla tutta."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {view && (
          <>
            <img
              src={url}
              alt=""
              draggable={false}
              className="map-image"
              width={image.width}
              height={image.height}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            />
            {pins.map((p) => {
              const s = toScreen(view, image, p);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`map-pin ${p.kind}${p.id === selectedId ? ' selected' : ''}`}
                  style={{ left: s.x, top: s.y }}
                  aria-label={`${PIN_KIND_LABELS[p.kind]}: ${p.title}`}
                  aria-pressed={p.id === selectedId}
                  title={p.title}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={() => onSelect(p.id)}
                >
                  <span className="map-pin-label">{p.title}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
      {full && overlay && <div className="map-overlay">{overlay}</div>}
      <div className="map-zoom" role="group" aria-label="Zoom">
        <button
          type="button"
          aria-label={full ? 'Esci dallo schermo intero' : 'Schermo intero'}
          aria-pressed={full}
          title={full ? 'Esci dallo schermo intero (Esc)' : 'Schermo intero'}
          onClick={() => onFullChange(!full)}
        >
          {full ? '✕' : '⛶'}
        </button>
        <button type="button" aria-label="Avvicina" onClick={() => zoomBy(1.5)}>
          +
        </button>
        <button type="button" aria-label="Allontana" onClick={() => zoomBy(1 / 1.5)}>
          −
        </button>
        <button type="button" aria-label="Mostra tutta la mappa" onClick={() => port && setView(fitView(image, port))}>
          ⤢
        </button>
      </div>
    </div>
  );
}
