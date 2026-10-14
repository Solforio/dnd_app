import { useState } from 'react';
import { FoldCard } from '../../components/FoldCard';
import type { Member } from '../../domain/party';
import { MasterSheetDialog } from './MasterSheetDialog';
import { TreasureMaker } from './TreasureMaker';

/**
 * The Master's area, inside the party page and only for the DM: the sheets the players have chosen to
 * show, and the treasure. For now the Master can read and give, not change a player's character.
 */
export function MasterPanel({ pid, members, myUid }: { pid: string; members: Member[]; myUid: string }) {
  const [viewing, setViewing] = useState<Member | null>(null);
  const players = members.filter((m) => m.uid !== myUid);

  return (
    <FoldCard id="master-panel" title="Master" summary="schede dei giocatori, tesori" className="span-all master-panel">
      <p className="small muted">
        Quest’area la vedi solo tu, come Master. Per ora puoi leggere le schede e consegnare tesori: non puoi cambiare i personaggi dei
        giocatori.
      </p>

      <h3>Schede dei giocatori</h3>
      {players.length === 0 ? (
        <p className="small muted">Nessun giocatore nel gruppo. Condividi il codice per farli entrare.</p>
      ) : (
        <ul className="plain stack">
          {players.map((m) => (
            <li key={m.uid} className="row master-player">
              <span className="master-player-name">
                <strong>{m.summary.characterName}</strong>
                <span className="small muted">
                  {' '}
                  {m.summary.class} · {m.username}
                </span>
              </span>
              {m.sharing.fullSheet ? (
                <button type="button" onClick={() => setViewing(m)}>
                  Vedi la scheda
                </button>
              ) : (
                <span className="small muted">Non condivide la scheda completa</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <TreasureMaker pid={pid} players={players} />
      {viewing && <MasterSheetDialog key={viewing.uid} pid={pid} uid={viewing.uid} label={viewing.summary.characterName} onClose={() => setViewing(null)} />}
    </FoldCard>
  );
}
