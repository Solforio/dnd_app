import { useId, useState, type ReactNode } from 'react';

/** One short line of help, with a «?» that opens the longer explanation. */
export function Hint({ short, children }: { short: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <p className="small muted hint">
        {short}{' '}
        <button type="button" className="hint-btn" aria-expanded={open} aria-controls={id} aria-label="Maggiori informazioni" onClick={() => setOpen((o) => !o)}>
          ?
        </button>
      </p>
      {open && (
        <p id={id} className="small muted hint-detail">
          {children}
        </p>
      )}
    </>
  );
}
