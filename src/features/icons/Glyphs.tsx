import type { ReactNode } from 'react';
import type { ConditionId } from '../../domain/sheet/rules';

/** Line icons on a 24-pixel grid, drawn in the text colour. They are decorative: the name is always written next to them. */

const SCHOOLS: Record<string, ReactNode> = {
  Abjuration: <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z M12 8v7 M9 11.5h6" />,
  Conjuration: <path d="M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 11a1 1 0 1 0 1 1" />,
  Divination: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  Enchantment: <path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" />,
  Evocation: <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  Illusion: (
    <>
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
    </>
  ),
  Necromancy: (
    <>
      <path d="M12 3a7 7 0 0 0-7 7c0 2.5 1 4 3 5v3h8v-3c2-1 3-2.5 3-5a7 7 0 0 0-7-7z M10 18v2 M14 18v2" />
      <circle cx="9" cy="11" r="1.3" />
      <circle cx="15" cy="11" r="1.3" />
    </>
  ),
  Transmutation: <path d="M4 12a8 8 0 0 1 14-5.3 M20 4v4h-4 M20 12a8 8 0 0 1-14 5.3 M4 20v-4h4" />,
};

const EYE = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z';

const CONDITIONS: Record<ConditionId | 'exhaustion', ReactNode> = {
  blinded: <path d={`${EYE} M3 3l18 18`} />,
  charmed: <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" />,
  deafened: <path d="M8 9a4 4 0 0 1 8 0c0 3-3 3-3 6a2 2 0 0 1-4 0 M3 3l18 18" />,
  frightened: (
    <>
      <path d="M6 21V10a6 6 0 0 1 12 0v11l-2.5-2-2 2-1.5-2-1.5 2-2-2z" />
      <circle cx="10" cy="10" r="1" />
      <circle cx="14" cy="10" r="1" />
    </>
  ),
  grappled: <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1 M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" />,
  incapacitated: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M5.6 5.6l12.8 12.8" />,
  invisible: <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />,
  paralyzed: <path d="M13 2 5 14h6l-1 8 8-12h-6z" />,
  petrified: <path d="M4 18l3-9 5-4 6 5 2 8z M10 12l2 6" />,
  poisoned: <path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z M9.5 15a2.5 2.5 0 0 0 2.5 2.5" />,
  prone: (
    <>
      <circle cx="5" cy="14" r="2" />
      <path d="M8 15h12 M14 15l2 4 M18 15l2-3" />
    </>
  ),
  restrained: <path d="M8 9a3 3 0 1 0 0 6h3 M16 9a3 3 0 1 1 0 6h-3 M9 12h6" />,
  stunned: <path d="M8 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1z M16 12l1.2 3.8 3.8 1.2-3.8 1.2L16 22l-1.2-3.8L11 17l3.8-1.2z" />,
  unconscious: <path d="M5 6h5l-5 6h5 M13 12h6l-6 7h6" />,
  exhaustion: <path d="M7 3h10 M7 21h10 M8 3c0 5 8 5 8 9s-8 4-8 9" />,
};

function Glyph({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <svg className="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** The sign of a school of magic (SRD school names, in English). */
export function SchoolGlyph({ school }: { school: string }) {
  const art = SCHOOLS[school];
  return art ? <Glyph title={school}>{art}</Glyph> : null;
}

/** The sign of a condition, or of exhaustion. */
export function ConditionGlyph({ id }: { id: ConditionId | 'exhaustion' }) {
  return <Glyph>{CONDITIONS[id]}</Glyph>;
}
