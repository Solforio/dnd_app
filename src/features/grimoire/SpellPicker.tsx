import { useId, useMemo, useState } from 'react';
import { useSpellCatalogue } from '../../data/spellCatalogue';
import { addSpell, listOf, type Capacity, type SpellClass } from '../../domain/spells';
import { editSheet, useSheet } from '../sheet/sheetHooks';
import { schoolLabel } from '../../domain/spellItalian';
import { excerpt, levelLabel } from './labels';
import { ReadButton } from './SpellRow';

const SHOWN = 30;

/** Search the SRD list of a class and add spells to the character, with the limits explained. */
export function SpellPicker({ sc, cap, onMessage }: { sc: SpellClass; cap: Capacity; onMessage: (text: string) => void }) {
  const sheet = useSheet();
  const { spells, byId } = useSpellCatalogue();
  const searchId = useId();
  const levelId = useId();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const list = listOf(sheet, sc.key);
  const have = new Set([...list.known, ...list.prepared]);
  const ignore = sheet.spellcasting.ignoreLimits;
  const top = ignore ? 9 : cap.maxLevel;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spells.filter(
      (sp) =>
        (ignore || sp.classes.includes(sc.list)) &&
        sp.level <= top &&
        (level === 'all' || sp.level === Number(level)) &&
        (q === '' || sp.name.toLowerCase().includes(q) || (sp.nameEn ?? '').toLowerCase().includes(q)),
    );
  }, [spells, query, level, top, ignore, sc.list]);

  return (
    <div className="stack spell-picker">
      <div className="row">
        <div className="field">
          <label htmlFor={searchId}>Cerca per nome</label>
          <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Fireball" />
        </div>
        <div className="field">
          <label htmlFor={levelId}>Livello</label>
          <select id={levelId} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="all">Tutti</option>
            {Array.from({ length: top + 1 }, (_, l) => (
              <option key={l} value={l}>
                {levelLabel(l)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ul className="plain stack">
        {matches.slice(0, SHOWN).map((sp) => (
          <li key={sp.id} className="spell-pick">
            <div className="spell-summary">
              <div className="spell-title">
                <strong>{sp.name}</strong>
                <span className="small muted">
                  {levelLabel(sp.level)} · {schoolLabel(sp.school)}
                </span>
              </div>
              <p className="small spell-excerpt">{excerpt(sp.text)}</p>
            </div>
            <ReadButton spell={sp} />
            <button
              type="button"
              disabled={have.has(sp.id)}
              onClick={() => {
                const r = addSpell(sheet, sc, cap, sp, byId);
                if (r.error) onMessage(r.error);
                else {
                  editSheet(() => r.sheet);
                  onMessage(`«${sp.name}» aggiunto.`);
                }
              }}
            >
              {have.has(sp.id) ? 'Già presente' : sc.mode === 'prepared' && sp.level > 0 ? 'Prepara' : 'Aggiungi'}
            </button>
          </li>
        ))}
      </ul>
      {matches.length === 0 && <p className="small muted">Nessun incantesimo trovato.</p>}
      {matches.length > SHOWN && (
        <p className="small muted">Altri {matches.length - SHOWN} risultati: scrivi qualche lettera del nome per restringere.</p>
      )}
    </div>
  );
}
