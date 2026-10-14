import { useId, useMemo, useState } from 'react';
import { FoldCard } from '../../components/FoldCard';
import { NumberField } from '../../components/NumberField';
import { useCharacterStore } from '../../data/characterStore';
import { answerTrade, offerTrade, removeTrade, useLootStore } from '../../data/lootStore';
import { describeLoot, emptyPurse, TRADE_STATUS_LABELS, tradeStep, type Trade } from '../../domain/loot';
import type { Member } from '../../domain/party';

/** What a trade carries, as a short line. */
const what = (t: Trade) => describeLoot(emptyPurse(), [t.item]);

/**
 * Swapping objects between members. An offer takes the object out of the offering character's backpack; the
 * other player accepts (it lands in their backpack) or refuses (it goes back). Each app only touches its own
 * player's backpack, the one of the character active on that device.
 */
export function TradesCard({ pid, members, myUid }: { pid: string; members: Member[]; myUid: string }) {
  const trades = useLootStore((s) => s.trades);
  const tradeNotice = useLootStore((s) => s.tradeNotice);
  const inventory = useCharacterStore((s) => s.character.inventory);
  const activeName = useCharacterStore((s) => s.character.name);
  const others = members.filter((m) => m.uid !== myUid);
  const tradable = useMemo(() => inventory.items.filter((i) => !i.isContainer && i.quantity > 0), [inventory.items]);
  const [toUid, setToUid] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const ids = { to: useId(), item: useId(), note: useId() };

  const to = others.find((m) => m.uid === toUid) ?? others[0];
  const item = tradable.find((i) => i.id === itemId) ?? tradable[0];
  const mine = (trades ?? []).filter((t) => t.from === myUid);
  const incoming = (trades ?? []).filter((t) => tradeStep(t, myUid) === 'respond');
  const outgoing = mine.filter((t) => t.status === 'pending');
  const finished = (trades ?? []).filter((t) => t.status !== 'pending');
  const run = async (p: Promise<string | null>, ok: string) => setMessage((await p) ?? ok);

  return (
    <FoldCard
      id="party-trades"
      title="Scambi"
      summary={incoming.length > 0 ? `${incoming.length} offerte per te` : 'scambia oggetti con i compagni'}
      className="span-all"
    >
      {incoming.length > 0 && (
        <ul className="plain stack">
          {incoming.map((t) => (
            <li key={t.id} className="treasure-card stack-tight">
              <span>
                <strong>{t.fromName}</strong> ti offre <strong>{what(t)}</strong>
              </span>
              {t.note && <span className="small muted">«{t.note}»</span>}
              <span className="small muted">Se accetti finisce nello zaino di {activeName || 'questo personaggio'}.</span>
              <div className="row">
                <button type="button" className="primary" onClick={() => void run(answerTrade(pid, t.id, 'accepted'), 'Offerta accettata.')}>
                  Accetta
                </button>
                <button type="button" onClick={() => void run(answerTrade(pid, t.id, 'declined'), 'Offerta rifiutata.')}>
                  Rifiuta
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>Offri un oggetto</h3>
      {others.length === 0 ? (
        <p className="small muted">Non ci sono altri membri nel gruppo.</p>
      ) : tradable.length === 0 ? (
        <p className="small muted">Lo zaino di {activeName || 'questo personaggio'} non ha oggetti da scambiare.</p>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!to || !item) return;
            void run(
              offerTrade(pid, { to: { uid: to.uid, name: to.summary.characterName }, itemId: item.id, quantity, note }).then((err) => {
                if (!err) {
                  setQuantity(1);
                  setNote('');
                }
                return err;
              }),
              `Offerta inviata a ${to.summary.characterName}: l’oggetto aspetta nella sua risposta.`,
            );
          }}
        >
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field">
              <label htmlFor={ids.item}>Oggetto</label>
              <select id={ids.item} value={item?.id ?? ''} onChange={(e) => { setItemId(e.target.value); setQuantity(1); }}>
                {tradable.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ×{i.quantity}
                  </option>
                ))}
              </select>
            </div>
            <NumberField label="Quanti" value={Math.min(quantity, item?.quantity ?? 1)} min={1} max={item?.quantity ?? 1} onCommit={setQuantity} />
            <div className="field">
              <label htmlFor={ids.to}>A chi</label>
              <select id={ids.to} value={to?.uid ?? ''} onChange={(e) => setToUid(e.target.value)}>
                {others.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.summary.characterName} ({m.username})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor={ids.note}>Messaggio (facoltativo)</label>
            <input id={ids.note} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Te lo cedo per la pozione" />
          </div>
          <div>
            <button type="submit" className="primary">
              Offri
            </button>
          </div>
        </form>
      )}

      {outgoing.length > 0 && (
        <>
          <h3>Le tue offerte in attesa</h3>
          <ul className="plain stack-tight">
            {outgoing.map((t) => (
              <li key={t.id} className="row master-player">
                <span className="small">
                  <strong>{what(t)}</strong> a {t.toName}
                </span>
                <button type="button" className="ghost" onClick={() => void run(answerTrade(pid, t.id, 'cancelled'), 'Offerta annullata: l’oggetto torna nello zaino.')}>
                  Annulla
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {finished.length > 0 && (
        <details>
          <summary className="small">Scambi conclusi ({finished.length})</summary>
          <ul className="plain stack-tight">
            {finished.map((t) => (
              <li key={t.id} className="row master-player">
                <span className="small">
                  {t.from === myUid ? `A ${t.toName}` : `Da ${t.fromName}`}: <strong>{what(t)}</strong> · {TRADE_STATUS_LABELS[t.status]}
                  {!t.settled && ' (in consegna)'}
                </span>
                {t.settled && (
                  <button type="button" className="ghost" aria-label="Togli dall’elenco" onClick={() => void removeTrade(pid, t.id)}>
                    Togli
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="status-line small" role="status" aria-live="polite">
        {message || tradeNotice}
      </p>
    </FoldCard>
  );
}
