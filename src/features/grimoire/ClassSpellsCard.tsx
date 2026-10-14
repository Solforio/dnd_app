import { useState } from 'react';
import { useSpellCatalogue } from '../../data/spellCatalogue';
import { formatNumber } from '../../domain/format/number';
import type { ClassEntry } from '../../domain/sheet/sheet';
import { capacityOf, castable, listOf, removeSpell, spellClassOf, togglePrepared, type Spell } from '../../domain/spells';
import { editSheet, useSheet } from '../sheet/sheetHooks';
import { SpellPicker } from './SpellPicker';
import { SpellRow } from './SpellRow';

const MODE_TEXT = {
  known: 'conosce un numero fisso di incantesimi e può lanciarli tutti',
  prepared: 'prepara gli incantesimi tra tutta la lista della classe',
  spellbook: 'copia gli incantesimi nel libro e ne prepara alcuni',
} as const;

function Count({ label, have, max }: { label: string; have: number; max: number | null }) {
  return (
    <span className={`count-chip${max !== null && have > max ? ' over' : ''}`}>
      {label} {formatNumber(have)}
      {max !== null && `/${formatNumber(max)}`}
    </span>
  );
}

/** The spells of one casting class: cantrips, known or prepared spells, the limits of its level, casting. */
export function ClassSpellsCard({ c, editing }: { c: ClassEntry; editing: boolean }) {
  const sheet = useSheet();
  const { byId, status } = useSpellCatalogue();
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const sc = spellClassOf(c);
  if (!sc) return null;
  const cap = capacityOf(c, sheet.abilities);
  const list = listOf(sheet, sc.key);
  const level = (id: string) => byId.get(id)?.level;
  const cantrips = list.known.filter((id) => level(id) === 0);
  const book = list.known.filter((id) => (level(id) ?? 0) > 0);
  const canCastNow = new Set(castable(sheet, sc, byId));
  const asSpells = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);
  const remove = (id: string) => editSheet((x) => removeSpell(x, sc.key, id));
  const prepare = (id: string) => {
    const r = togglePrepared(sheet, sc, cap, id);
    if (r.error) setMessage(r.error);
    else editSheet(() => r.sheet);
  };

  const row = (spell: Spell, kind: 'cantrip' | 'known' | 'book' | 'prepared') => (
    <SpellRow key={spell.id} spell={spell} canCast={canCastNow.has(spell.id)}>
      {kind === 'book' && (
        <button type="button" aria-pressed={list.prepared.includes(spell.id)} onClick={() => prepare(spell.id)}>
          {list.prepared.includes(spell.id) ? 'Preparato ✓' : 'Prepara'}
        </button>
      )}
      {kind === 'prepared' && (
        <button type="button" className="ghost" onClick={() => remove(spell.id)}>
          Non preparare
        </button>
      )}
      {(editing || kind === 'cantrip' || kind === 'known' || kind === 'book') && kind !== 'prepared' && (
        <button type="button" className="ghost" aria-label={`Togli ${spell.name}`} onClick={() => remove(spell.id)}>
          Togli
        </button>
      )}
    </SpellRow>
  );

  return (
    <section className="card stack" aria-label={`Incantesimi: ${sc.label}`}>
      <h2>
        {sc.label} <span className="muted">· livello {formatNumber(c.level)}</span>
      </h2>
      {cap.maxLevel === 0 ? (
        <p className="small muted">A questo livello {sc.label.toLowerCase()} non ha ancora incantesimi.</p>
      ) : (
        <>
          <p className="small muted">
            {sc.label} {MODE_TEXT[sc.mode]}. Caratteristica: {sc.ability.toUpperCase()}. Incantesimi fino al {cap.maxLevel}° livello.
          </p>
          <div className="row counts">
            {cap.cantrips > 0 && <Count label="Trucchetti" have={cantrips.length} max={cap.cantrips} />}
            {sc.mode === 'known' && <Count label="Conosciuti" have={book.length} max={cap.spells} />}
            {sc.mode === 'spellbook' && <Count label="Nel libro" have={book.length} max={cap.spells} />}
            {sc.mode !== 'known' && <Count label="Preparati" have={list.prepared.length} max={cap.prepared} />}
          </div>

          {status === 'loading' && <p className="small muted">Carico l’elenco degli incantesimi…</p>}
          {status === 'error' && (
            <p className="small red" role="alert">
              Non riesco a caricare l’elenco degli incantesimi: controlla la connessione e riapri la pagina.
            </p>
          )}

          {cap.cantrips > 0 && (
            <>
              <h3>Trucchetti</h3>
              {cantrips.length === 0 ? <p className="small muted">Nessun trucchetto scelto.</p> : <ul className="plain spell-list">{asSpells(cantrips).map((s) => row(s, 'cantrip'))}</ul>}
            </>
          )}

          {sc.mode === 'known' && (
            <>
              <h3>Incantesimi conosciuti</h3>
              {book.length === 0 ? <p className="small muted">Nessun incantesimo scelto.</p> : <ul className="plain spell-list">{asSpells(book).map((s) => row(s, 'known'))}</ul>}
            </>
          )}
          {sc.mode === 'spellbook' && (
            <>
              <h3>Libro degli incantesimi</h3>
              {book.length === 0 ? <p className="small muted">Il libro è vuoto.</p> : <ul className="plain spell-list">{asSpells(book).map((s) => row(s, 'book'))}</ul>}
            </>
          )}
          {sc.mode === 'prepared' && (
            <>
              <h3>Incantesimi preparati</h3>
              {list.prepared.length === 0 ? (
                <p className="small muted">Nessun incantesimo preparato.</p>
              ) : (
                <ul className="plain spell-list">{asSpells(list.prepared).map((s) => row(s, 'prepared'))}</ul>
              )}
            </>
          )}

          <div>
            <button type="button" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
              {adding ? 'Chiudi la ricerca' : sc.mode === 'prepared' ? 'Prepara incantesimi' : 'Aggiungi incantesimi'}
            </button>
          </div>
          {adding && status === 'ready' && <SpellPicker sc={sc} cap={cap} onMessage={setMessage} />}
          <p className="status-line small" role="status" aria-live="polite">
            {message}
          </p>
        </>
      )}
    </section>
  );
}
