import { useId, useState } from 'react';
import { NumberField } from '../../components/NumberField';
import { TextField } from '../../components/TextField';
import { formatNumber } from '../../domain/format/number';
import { SHEET_LIMITS } from '../../domain/sheet/sheet';
import { editSheet, useSheet } from './sheetHooks';

function splitLanguages(text: string): string[] {
  return text
    .split(',')
    .map((l) => l.trim().slice(0, 40))
    .filter((l) => l !== '')
    .slice(0, SHEET_LIMITS.languages);
}

/** Comma-separated languages, split when the field loses focus so typing a comma is not interrupted. */
function LanguagesField({ languages }: { languages: string[] }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    editSheet((x) => ({ ...x, languages: splitLanguages(draft) }));
    setDraft(null);
  };
  return (
    <div className="field">
      <label htmlFor={id}>Lingue (separate da virgole)</label>
      <input
        id={id}
        value={draft ?? languages.join(', ')}
        maxLength={900}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </div>
  );
}

export function TraitsCard({ editing }: { editing: boolean }) {
  const s = useSheet();

  return (
    <section className="card stack" aria-labelledby="traits-title">
      <h2 id="traits-title">Lingue, sensi e competenze</h2>
      {editing ? (
        <>
          <LanguagesField languages={s.languages} />
          <NumberField
            label="Scurovisione (m, 0 se assente)"
            value={s.darkvisionM}
            min={0}
            max={SHEET_LIMITS.metres}
            decimals={1}
            onCommit={(darkvisionM) => editSheet((x) => ({ ...x, darkvisionM }))}
          />
          <TextField
            label="Altre competenze (armature, armi, strumenti)"
            multiline
            value={s.otherProficiencies}
            maxLength={SHEET_LIMITS.otherProficiencies}
            onChange={(otherProficiencies) => editSheet((x) => ({ ...x, otherProficiencies }))}
          />
        </>
      ) : (
        <dl className="traits">
          <dt>Lingue</dt>
          <dd>{s.languages.length > 0 ? s.languages.join(', ') : '—'}</dd>
          <dt>Scurovisione</dt>
          <dd>{s.darkvisionM > 0 ? `${formatNumber(s.darkvisionM, 1)} m` : 'No'}</dd>
          <dt>Altre competenze</dt>
          <dd className="pre-wrap">{s.otherProficiencies || '—'}</dd>
        </dl>
      )}
    </section>
  );
}
