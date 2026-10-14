import { useState } from 'react';
import { FoldCard } from '../../components/FoldCard';
import { takeTreasure, useLootStore } from '../../data/lootStore';
import { useCharacterStore } from '../../data/characterStore';
import { canClaim, describeLoot } from '../../domain/loot';

/** Treasure the Master has put on the table: the ones for me, or for whoever is first, ready to take. */
export function TreasureShelf({ pid, uid }: { pid: string; uid: string }) {
  const treasures = useLootStore((s) => s.treasures);
  const notice = useLootStore((s) => s.notice);
  const active = useCharacterStore((s) => s.character.name);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const open = (treasures ?? []).filter((t) => canClaim(t, uid)).sort((a, b) => b.createdAt - a.createdAt);
  const taken = (treasures ?? []).filter((t) => t.status === 'claimed').sort((a, b) => b.claimedAt - a.claimedAt).slice(0, 5);

  return (
    <FoldCard id="party-treasure" title="Tesori del gruppo" summary={open.length > 0 ? `${open.length} da prendere` : 'niente da prendere'} className="span-all">
      {treasures === null ? (
        <p className="muted small">Carico i tesori…</p>
      ) : open.length === 0 ? (
        <p className="small muted">Nessun tesoro in attesa: quando il Master ne mette uno sul tavolo lo trovi qui.</p>
      ) : (
        <ul className="plain stack">
          {open.map((t) => (
            <li key={t.id} className="treasure-card stack-tight">
              <strong>{t.title}</strong>
              {t.note && <span className="small muted">{t.note}</span>}
              <span>{describeLoot(t.coins, t.items)}</span>
              <span className="small muted">{t.to === uid ? 'È per te.' : 'Lo prende chi arriva prima.'} Finirà nello zaino di {active || 'questo personaggio'}.</span>
              <div>
                <button
                  type="button"
                  className="primary"
                  disabled={busy === t.id}
                  onClick={async () => {
                    setBusy(t.id);
                    setMessage((await takeTreasure(pid, t)) ?? '');
                    setBusy('');
                  }}
                >
                  Prendi
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {taken.length > 0 && (
        <details>
          <summary className="small">Già presi</summary>
          <ul className="plain stack-tight">
            {taken.map((t) => (
              <li key={t.id} className="small">
                <strong>{t.title}</strong> ({describeLoot(t.coins, t.items)}) preso da {t.claimedByName || 'un giocatore'}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="status-line small" role="status" aria-live="polite">
        {message || notice}
      </p>
    </FoldCard>
  );
}
