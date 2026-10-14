import { useId, useState } from 'react';
import { NumberField } from '../../components/NumberField';
import { TextField } from '../../components/TextField';
import { createTreasures, removeTreasure, useLootStore, type TreasureDraft } from '../../data/lootStore';
import { CATEGORIES, CATEGORY_LABELS, COIN_LABELS, COINS, fromUnit, type Category } from '../../domain/inventory';
import { describeLoot, emptyPurse, LOOT_LIMITS, sanitizeLootItem, splitPurse, type Purse } from '../../domain/loot';
import type { Member } from '../../domain/party';

interface ItemRow {
  key: number;
  name: string;
  quantity: number;
  category: Category;
  /** In kilograms, per unit, as typed. */
  weightKg: number;
  /** In gold pieces, per unit, as typed. */
  valueGp: number;
}

const SPLIT = '__split__';

/** The Master prepares coins and objects and puts them on the table, for one player, for whoever is first, or split. */
export function TreasureMaker({ pid, players }: { pid: string; players: Member[] }) {
  const treasures = useLootStore((s) => s.treasures);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [coins, setCoins] = useState<Purse>(emptyPurse());
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [nextKey, setNextKey] = useState(1);
  const toId = useId();

  const addRow = () => {
    setRows((r) => [...r, { key: nextKey, name: '', quantity: 1, category: 'treasure', weightKg: 0, valueGp: 0 }]);
    setNextKey((k) => k + 1);
  };
  const setRow = (key: number, patch: Partial<ItemRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const create = async () => {
    const items = rows
      .filter((r) => r.name.trim() !== '')
      .map((r) =>
        sanitizeLootItem({
          name: r.name,
          category: r.category,
          quantity: r.quantity,
          weightLb: fromUnit(r.weightKg, 'kg'),
          valueCp: Math.round(r.valueGp * 100),
        }),
      );
    const base = { title, note };
    let drafts: TreasureDraft[];
    if (to === SPLIT) {
      const shares = splitPurse(coins, Math.max(1, players.length));
      drafts = players.map((p, i) => ({ ...base, title: `${title.trim() || 'Monete'} (parte di ${p.summary.characterName})`, coins: shares[i]!, items: [], to: p.uid }));
      if (items.length > 0) drafts.push({ ...base, coins: emptyPurse(), items, to: null });
    } else {
      drafts = [{ ...base, coins, items, to: to || null }];
    }
    setBusy(true);
    const err = await createTreasures(pid, drafts);
    setBusy(false);
    setMessage(err ?? 'Tesoro messo sul tavolo: i giocatori lo vedono nella loro pagina del gruppo.');
    if (!err) {
      setTitle('');
      setNote('');
      setCoins(emptyPurse());
      setRows([]);
      setTo('');
    }
  };

  const nameOf = (uid: string | null) => (uid ? (players.find((p) => p.uid === uid)?.summary.characterName ?? 'un giocatore') : 'chi arriva prima');

  return (
    <div className="stack">
      <h3>Crea un tesoro</h3>
      <div className="form-grid">
        <TextField label="Nome del tesoro" value={title} maxLength={LOOT_LIMITS.title} onChange={setTitle} />
        <TextField label="Descrizione (facoltativa)" value={note} maxLength={LOOT_LIMITS.note} onChange={setNote} />
      </div>

      <fieldset className="plain stack">
        <legend className="label">Monete</legend>
        <div className="row">
          {COINS.map((c) => (
            <NumberField
              key={c}
              label={COIN_LABELS[c].long}
              value={coins[c]}
              min={0}
              max={LOOT_LIMITS.coin}
              onCommit={(n) => setCoins((p) => ({ ...p, [c]: n }))}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="plain stack">
        <legend className="label">Oggetti</legend>
        {rows.map((r) => (
          <div key={r.key} className="row loot-row">
            <TextField label="Nome" value={r.name} maxLength={LOOT_LIMITS.itemName} onChange={(name) => setRow(r.key, { name })} />
            <NumberField label="Quantità" value={r.quantity} min={1} max={LOOT_LIMITS.quantity} onCommit={(quantity) => setRow(r.key, { quantity })} />
            <div className="field">
              <label htmlFor={`${toId}-cat-${r.key}`}>Tipo</label>
              <select id={`${toId}-cat-${r.key}`} value={r.category} onChange={(e) => setRow(r.key, { category: e.target.value as Category })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <NumberField label="Peso (kg, cad.)" value={r.weightKg} min={0} max={1000} decimals={2} onCommit={(weightKg) => setRow(r.key, { weightKg })} />
            <NumberField label="Valore (mo, cad.)" value={r.valueGp} min={0} max={1_000_000} decimals={2} onCommit={(valueGp) => setRow(r.key, { valueGp })} />
            <button type="button" className="ghost" aria-label={`Togli ${r.name || 'l’oggetto'}`} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}>
              ✕
            </button>
          </div>
        ))}
        {rows.length < LOOT_LIMITS.items && (
          <div>
            <button type="button" onClick={addRow}>
              Aggiungi un oggetto
            </button>
          </div>
        )}
      </fieldset>

      <div className="field">
        <label htmlFor={toId}>Per chi</label>
        <select id={toId} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Chi lo prende per primo</option>
          {players.map((p) => (
            <option key={p.uid} value={p.uid}>
              Solo {p.summary.characterName}
            </option>
          ))}
          {players.length > 1 && <option value={SPLIT}>Dividi le monete in parti uguali tra i giocatori</option>}
        </select>
      </div>
      {to === SPLIT && <p className="small muted">Gli oggetti, se ci sono, restano in un tesoro a parte per chi li prende per primo.</p>}

      <div>
        <button type="button" className="primary" disabled={busy} onClick={() => void create()}>
          Metti sul tavolo
        </button>
      </div>
      <p className="status-line small" role="status" aria-live="polite">
        {message}
      </p>

      <h3>Tesori sul tavolo</h3>
      {treasures === null ? (
        <p className="muted small">Carico i tesori…</p>
      ) : treasures.length === 0 ? (
        <p className="small muted">Nessun tesoro ancora.</p>
      ) : (
        <ul className="plain stack">
          {[...treasures]
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((t) => (
              <li key={t.id} className="row master-player">
                <span>
                  <strong>{t.title}</strong> <span className="small muted">{describeLoot(t.coins, t.items)}</span>
                  <br />
                  <span className="small muted">
                    {t.status === 'claimed' ? `Preso da ${t.claimedByName || 'un giocatore'}` : `Per ${nameOf(t.to)}, non ancora preso`}
                  </span>
                </span>
                <button type="button" className="ghost" onClick={async () => setMessage((await removeTreasure(pid, t.id)) ?? 'Tesoro tolto dal tavolo.')}>
                  {t.status === 'claimed' ? 'Rimuovi dall’elenco' : 'Ritira'}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
