import { useId, useState } from 'react';
import { FoldCard } from '../../components/FoldCard';
import { NumberField } from '../../components/NumberField';
import { useCharacterStore } from '../../data/characterStore';
import { newId } from '../../domain/character';
import { formatNumber } from '../../domain/format/number';
import {
  ATTUNEMENT_LIMIT,
  attunedCount,
  capacityLb,
  carriedWeightLb,
  CATEGORIES,
  CATEGORY_LABELS,
  clampCapacityPerStr,
  COIN_LABELS,
  COINS,
  coinsValueCp,
  coinsWeightLb,
  contentsWeightLb,
  CAPACITY_PER_STR,
  DEFAULT_CAPACITY_PER_STR_LB,
  encumbrance,
  ENCUMBRANCE_LABELS,
  formatGp,
  formatWeight,
  fromUnit,
  ITEM_LIMIT,
  newItem,
  speedPenaltyM,
  toUnit,
  totalValueCp,
  type Category,
  type Item,
  type WeightUnit,
} from '../../domain/inventory';
import { editInventory, setItem, useInventory } from './inventoryHooks';
import { ItemEditor } from './ItemEditor';

function ItemRow({ item, items, unit, open, onToggle }: { item: Item; items: Item[]; unit: WeightUnit; open: boolean; onToggle: () => void }) {
  if (open) {
    return (
      <li>
        <ItemEditor item={item} items={items} unit={unit} onClose={onToggle} />
      </li>
    );
  }
  const contents = item.isContainer ? contentsWeightLb(items, item.id) : 0;
  const overCapacity = item.isContainer && item.containerCapacityLb !== null && contents > item.containerCapacityLb;
  return (
    <li className={`item-row${item.containerId ? ' inside' : ''}${item.isContainer ? ' container' : ''}`}>
      <div className="item-main">
        <span className="item-name">
          {item.name}
          {item.equipped && <span className="result-tag">equip.</span>}
          {item.attuned && <span className="result-tag crit">sintonizzato</span>}
          {item.requiresAttunement && !item.attuned && <span className="result-tag">richiede sintonia</span>}
        </span>
        <span className="small muted">
          {CATEGORY_LABELS[item.category]}
          {item.weightLb > 0 && ` · ${formatWeight(item.weightLb * item.quantity, unit)}`}
          {item.valueCp > 0 && ` · ${formatGp(item.valueCp * item.quantity)}`}
          {item.isContainer &&
            ` · contenuto ${formatWeight(contents, unit)}` +
              (item.containerCapacityLb ? ` su ${formatWeight(item.containerCapacityLb, unit)}` : '') +
              (item.weightlessContents ? ' (non pesa)' : '')}
        </span>
        {overCapacity && <span className="small red">Il contenitore è troppo pieno.</span>}
        {item.notes && <span className="small muted pre-wrap">{item.notes}</span>}
      </div>
      <div className="row item-actions">
        <button
          type="button"
          aria-label={`Uno in meno: ${item.name}`}
          disabled={item.quantity <= 0}
          onClick={() => setItem(item.id, { quantity: item.quantity - 1 })}
        >
          −
        </button>
        <span className="qty" aria-label={`Quantità di ${item.name}`}>
          ×{formatNumber(item.quantity)}
        </span>
        <button type="button" aria-label={`Uno in più: ${item.name}`} onClick={() => setItem(item.id, { quantity: item.quantity + 1 })}>
          +
        </button>
        <button type="button" className="ghost" onClick={onToggle}>
          Modifica<span className="visually-hidden"> {item.name}</span>
        </button>
      </div>
    </li>
  );
}

export function InventoryPage() {
  const inv = useInventory();
  const name = useCharacterStore((s) => s.character.name);
  const strength = useCharacterStore((s) => s.character.sheet.abilities.str);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const searchId = useId();
  const categoryId = useId();
  const unitName = useId();

  const { settings, items } = inv;
  const unit = settings.weightUnit;
  const weight = carriedWeightLb(inv);
  const capacity = capacityLb(strength, settings);
  const state = encumbrance(weight, capacity, settings.variantEncumbrance);
  const penalty = speedPenaltyM(state, settings.variantEncumbrance);
  const pct = capacity > 0 ? Math.min(100, (weight / capacity) * 100) : 100;

  const q = search.trim().toLowerCase();
  const matches = (i: Item) => (!q || `${i.name} ${i.notes}`.toLowerCase().includes(q)) && (!category || i.category === category);
  const filtering = q !== '' || category !== '';
  // Containers are listed with their contents underneath; while filtering, a flat list is clearer.
  const ordered: Item[] = filtering
    ? items.filter(matches)
    : items.filter((i) => !i.containerId).flatMap((i) => (i.isContainer ? [i, ...items.filter((c) => c.containerId === i.id)] : [i]));

  const add = () => {
    const item = newItem(newId());
    editInventory((x) => ({ ...x, items: [...x.items, item] }));
    setOpenId(item.id);
    setSearch('');
    setCategory('');
  };

  return (
    <main className="app-main sheet">
      <section className="card stack span-all" aria-labelledby="inv-title">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="inv-title" style={{ margin: 0 }}>
            Zaino di {name || 'Senza nome'}
          </h2>
          <fieldset className="segmented unit-toggle">
            <legend className="visually-hidden">Unità di peso</legend>
            {(['kg', 'lb'] as const).map((u) => (
              <label key={u}>
                <input
                  type="radio"
                  name={unitName}
                  checked={unit === u}
                  onChange={() => editInventory((x) => ({ ...x, settings: { ...x.settings, weightUnit: u } }))}
                />
                {u}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="stack-tight">
          <p className="hp-numbers">
            {formatWeight(weight, unit)}
            <span className="muted"> / {formatWeight(capacity, unit)}</span>
          </p>
          <div className="hp-bar" role="meter" aria-label="Peso trasportato" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={weight}>
            <span className={`cur load ${state}`} style={{ width: `${pct}%` }} />
          </div>
          <p className={`small encumbrance ${state}`} role="status" aria-live="polite">
            {ENCUMBRANCE_LABELS[state]}
            {penalty > 0 && ` · velocità −${formatNumber(penalty)} m`}
            {state === 'over' && ' · trasporti più della tua capacità'}
          </p>
        </div>
        <p className="small muted">
          Valore totale {formatGp(totalValueCp(inv))} · Sintonia {formatNumber(attunedCount(items))}/{formatNumber(ATTUNEMENT_LIMIT)} · Capacità = FOR{' '}
          {formatNumber(strength)} × {formatWeight(settings.capacityPerStrLb, unit)}
        </p>
      </section>

      <div className="column">
        <section className="card stack" aria-labelledby="items-title">
          <h2 id="items-title">Oggetti</h2>
          <div className="row">
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label htmlFor={searchId}>Cerca</label>
              <input id={searchId} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={categoryId}>Categoria</label>
              <select id={categoryId} value={category} onChange={(e) => setCategory(e.target.value as Category | '')}>
                <option value="">Tutte</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="muted">Lo zaino è vuoto: aggiungi armi, armature e attrezzatura.</p>
          ) : ordered.length === 0 ? (
            <p className="muted">Nessun oggetto corrisponde alla ricerca.</p>
          ) : (
            <ul className="list">
              {ordered.map((i) => (
                <ItemRow key={i.id} item={i} items={items} unit={unit} open={openId === i.id} onToggle={() => setOpenId(openId === i.id ? null : i.id)} />
              ))}
            </ul>
          )}
          <div>
            <button type="button" className="primary" disabled={items.length >= ITEM_LIMIT} onClick={add}>
              Aggiungi oggetto
            </button>
          </div>
        </section>
      </div>

      <div className="column">
        <section className="card stack" aria-labelledby="coins-title">
          <h2 id="coins-title">Monete</h2>
          <div className="coins">
            {COINS.map((c) => (
              <NumberField
                key={c}
                label={COIN_LABELS[c].short}
                value={inv.coins[c]}
                min={0}
                max={100_000_000}
                onCommit={(v) => editInventory((x) => ({ ...x, coins: { ...x.coins, [c]: v } }))}
              />
            ))}
          </div>
          <p className="small">
            Totale {formatGp(coinsValueCp(inv.coins))}
            <span className="muted">
              {' '}
              · {settings.coinsHaveWeight ? `pesano ${formatWeight(coinsWeightLb(inv.coins), unit)}` : 'non pesano'}
            </span>
          </p>
        </section>

        <FoldCard id="inv-settings" title="Impostazioni del peso" defaultOpen={false}>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <NumberField
              label={`Capacità per punto di FOR (${unit})`}
              value={toUnit(settings.capacityPerStrLb, unit)}
              min={toUnit(CAPACITY_PER_STR.min, unit)}
              max={toUnit(CAPACITY_PER_STR.max, unit)}
              decimals={2}
              onCommit={(v) =>
                editInventory((x) => ({
                  ...x,
                  settings: { ...x.settings, capacityPerStrLb: clampCapacityPerStr(fromUnit(v, unit)) },
                }))
              }
            />
            <button
              type="button"
              disabled={settings.capacityPerStrLb === DEFAULT_CAPACITY_PER_STR_LB}
              onClick={() => editInventory((x) => ({ ...x, settings: { ...x.settings, capacityPerStrLb: DEFAULT_CAPACITY_PER_STR_LB } }))}
            >
              Ripristina 15 lb ({formatWeight(DEFAULT_CAPACITY_PER_STR_LB, 'kg')})
            </button>
          </div>
          <label className="inline">
            <input
              type="checkbox"
              checked={settings.variantEncumbrance}
              onChange={(e) => editInventory((x) => ({ ...x, settings: { ...x.settings, variantEncumbrance: e.target.checked } }))}
            />
            Regola variante dell’ingombro (oltre ⅓ della capacità −3 m, oltre ⅔ −6 m)
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={settings.coinsHaveWeight}
              onChange={(e) => editInventory((x) => ({ ...x, settings: { ...x.settings, coinsHaveWeight: e.target.checked } }))}
            />
            Le monete pesano (50 monete = 1 lb)
          </label>
          <p className="small muted">1 lb = 0,5 kg, come nel Manuale del Giocatore italiano. I pesi sono salvati in libbre.</p>
        </FoldCard>
      </div>
    </main>
  );
}
