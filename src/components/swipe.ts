/**
 * Swiping sideways on a page moves to the next or the previous section. A swipe that starts on something
 * that already uses sideways touches (a map, a field, a dialog, a scrolling strip) is left alone.
 */

const MIN_DISTANCE = 80;
const MAX_TIME = 700;
/** How much more horizontal than vertical the gesture must be, so scrolling the page never counts. */
const DOMINANCE = 1.8;

function blocked(start: EventTarget | null): boolean {
  if (document.querySelector('dialog[open]')) return true;
  for (let el = start instanceof Element ? start : null; el && el !== document.body; el = el.parentElement) {
    if (el.matches('input, textarea, select, dialog, .map-viewport, [data-no-swipe]')) return true;
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return true;
  }
  return false;
}

/** Calls `onSwipe(+1)` for a swipe to the left (next section) and `onSwipe(-1)` for one to the right. Returns the cleanup. */
export function watchSwipes(onSwipe: (direction: 1 | -1) => void): () => void {
  let start: { x: number; y: number; at: number } | null = null;

  const down = (e: TouchEvent) => {
    const t = e.touches[0];
    start = e.touches.length === 1 && t && !blocked(e.target) ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  };
  const up = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    const from = start;
    start = null;
    if (!from || !t || Date.now() - from.at > MAX_TIME) return;
    const dx = t.clientX - from.x;
    const dy = t.clientY - from.y;
    if (Math.abs(dx) >= MIN_DISTANCE && Math.abs(dx) >= Math.abs(dy) * DOMINANCE) onSwipe(dx < 0 ? 1 : -1);
  };
  const cancel = () => {
    start = null;
  };

  document.addEventListener('touchstart', down, { passive: true });
  document.addEventListener('touchend', up, { passive: true });
  document.addEventListener('touchcancel', cancel, { passive: true });
  return () => {
    document.removeEventListener('touchstart', down);
    document.removeEventListener('touchend', up);
    document.removeEventListener('touchcancel', cancel);
  };
}
