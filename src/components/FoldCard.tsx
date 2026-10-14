import { useState, type ReactNode } from 'react';

const KEY = (id: string) => `dnd-companion:fold:${id}`;

function readOpen(id: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(KEY(id));
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

/**
 * A card whose body folds away. The title is a button; folded, it can show a one-line summary.
 * The state is remembered per card id on this device.
 */
export function FoldCard({
  id,
  title,
  summary,
  defaultOpen = true,
  className = '',
  children,
}: {
  id: string;
  title: string;
  /** Shown next to the title while folded. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(KEY(id), next ? '1' : '0');
    } catch {
      // Private mode: the card stays as chosen until the page closes.
    }
  };

  return (
    <section className={`card stack fold${open ? ' open' : ''}${className ? ` ${className}` : ''}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="fold-head">
        <button type="button" aria-expanded={open} aria-controls={`${id}-panel`} onClick={toggle}>
          <span className="fold-title">{title}</span>
          {!open && summary && <span className="small muted fold-summary">{summary}</span>}
          <span className="fold-chevron" aria-hidden="true">
            ▸
          </span>
        </button>
      </h2>
      <div id={`${id}-panel`} className="stack" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
