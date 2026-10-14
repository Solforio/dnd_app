import { useEffect, useRef } from 'react';
import { useSpellDialog } from '../../data/spellDialog';
import type { Spell } from '../../domain/spells';
import { SchoolGlyph } from '../icons/Glyphs';
import { levelLabel } from './labels';

/** Everything the SRD says about a spell: facts, text and the higher-level effect. */
export function SpellBody({ spell }: { spell: Spell }) {
  return (
    <div className="stack">
      <p className="small muted">
        <SchoolGlyph school={spell.school} /> {levelLabel(spell.level)} · {spell.school}
        {spell.concentration && ' · Concentrazione'}
        {spell.ritual && ' · Rituale'}
      </p>
      <dl className="spell-facts small">
        <div>
          <dt>Tempo di lancio</dt>
          <dd>{spell.castingTime}</dd>
        </div>
        <div>
          <dt>Gittata</dt>
          <dd>{spell.range}</dd>
        </div>
        <div>
          <dt>Componenti</dt>
          <dd>
            {spell.components}
            {spell.material ? ` (${spell.material})` : ''}
          </dd>
        </div>
        <div>
          <dt>Durata</dt>
          <dd>{spell.duration}</dd>
        </div>
      </dl>
      {spell.text.split('\n\n').map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {spell.higher && (
        <p>
          <strong>Ai livelli superiori. </strong>
          {spell.higher}
        </p>
      )}
    </div>
  );
}

/** The reading window, opened from any spell in the app. */
export function SpellDialog() {
  const spell = useSpellDialog((s) => s.spell);
  const close = useSpellDialog((s) => s.close);
  const autoOpen = useSpellDialog((s) => s.autoOpen);
  const setAutoOpen = useSpellDialog((s) => s.setAutoOpen);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (spell && !d.open) d.showModal();
    if (!spell && d.open) d.close();
  }, [spell]);

  return (
    <dialog
      ref={ref}
      className="spell-dialog"
      aria-labelledby="spell-dialog-title"
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
    >
      {spell && (
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="spell-dialog-title" style={{ margin: 0 }}>
              {spell.name}
            </h2>
            <button type="button" onClick={close} autoFocus>
              Chiudi
            </button>
          </div>
          <SpellBody spell={spell} />
          <label className="inline">
            <input type="checkbox" checked={autoOpen} onChange={(e) => setAutoOpen(e.target.checked)} />
            Apri questa finestra ogni volta che lancio un incantesimo
          </label>
          <p className="small muted">Testo del System Reference Document 5.1 (CC-BY 4.0), in inglese.</p>
        </div>
      )}
    </dialog>
  );
}

/** After a cast: what happened, with a button to read the spell. */
export function SpellNotice() {
  const notice = useSpellDialog((s) => s.notice);
  const open = useSpellDialog((s) => s.open);
  const dismiss = useSpellDialog((s) => s.dismissNotice);
  const spellOpen = useSpellDialog((s) => s.spell !== null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismiss, 12000);
    return () => clearTimeout(t);
  }, [notice, dismiss]);

  if (!notice || spellOpen) return null;
  return (
    <div className="spell-notice" role="status" aria-live="polite">
      <span>{notice.message}</span>
      <button type="button" onClick={() => open(notice.spell)}>
        Leggi
      </button>
      <button type="button" className="ghost" aria-label="Chiudi l’avviso" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
