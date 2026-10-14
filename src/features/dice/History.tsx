import { useState } from 'react';
import { FoldCard } from '../../components/FoldCard';
import { useCharacterStore } from '../../data/characterStore';
import { HISTORY_LIMIT } from '../../domain/character';
import { formatNumber } from '../../domain/format/number';
import { MODE_LABEL } from './labels';
import { RollBreakdown } from './RollBreakdown';

const timeFormat = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });

function when(at: number): string {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today ? timeFormat.format(d) : `${dayFormat.format(d)}, ${timeFormat.format(d)}`;
}

const RECENT = 5;

export function History() {
  const history = useCharacterStore((s) => s.character.history);
  const clearHistory = useCharacterStore((s) => s.clearHistory);
  const [confirming, setConfirming] = useState(false);
  const [all, setAll] = useState(false);
  const shown = all ? history : history.slice(0, RECENT);

  return (
    <FoldCard
      id="history"
      title="Storico"
      summary={history.length === 0 ? 'nessun tiro' : `${formatNumber(history.length)} tiri`}
    >

      {history.length === 0 ? (
        <p className="muted">Ancora nessun tiro. I tuoi lanci compariranno qui.</p>
      ) : (
        <ol className="list history" aria-label="Ultimi tiri, dal più recente">
          {shown.map((r) => {
            const state = r.crit ? ' crit' : r.fumble ? ' fumble' : '';
            return (
              <li key={r.id} className={`history-item${state}`}>
                <span>
                  {r.label && <strong>{r.label} · </strong>}
                  <code>{r.formula}</code>
                  {r.mode !== 'normal' && <span className="result-tag">{MODE_LABEL[r.mode]}</span>}
                  {r.crit && <span className="result-tag crit">Critico</span>}
                  {r.fumble && <span className="result-tag fumble">Fallimento critico</span>}
                </span>
                <span className="total">
                  <span className="visually-hidden">Totale </span>
                  {formatNumber(r.total)}
                </span>
                <span className="row small">
                  <RollBreakdown terms={r.terms} />
                  <time className="meta" dateTime={new Date(r.at).toISOString()}>
                    {when(r.at)}
                  </time>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {history.length > RECENT && (
        <div className="row">
          <button type="button" className="ghost" aria-expanded={all} onClick={() => setAll((a) => !a)}>
            {all ? 'Mostra solo gli ultimi 5' : `Mostra tutti (${formatNumber(history.length)} di ${formatNumber(HISTORY_LIMIT)})`}
          </button>
        </div>
      )}

      {history.length > 0 &&
        (confirming ? (
          <div className="row" role="group" aria-label="Conferma">
            <span>Cancellare tutti i {formatNumber(history.length)} tiri?</span>
            <button
              type="button"
              className="danger"
              onClick={() => {
                clearHistory();
                setConfirming(false);
              }}
              autoFocus
            >
              Sì, cancella lo storico
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Annulla
            </button>
          </div>
        ) : (
          <div>
            <button type="button" className="ghost" onClick={() => setConfirming(true)}>
              Cancella lo storico
            </button>
          </div>
        ))}
    </FoldCard>
  );
}
