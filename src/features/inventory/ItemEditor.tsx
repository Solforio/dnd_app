import { useId } from 'react';
import { NumberField } from '../../components/NumberField';
import { TextField } from '../../components/TextField';
import {
  ATTUNEMENT_LIMIT,
  attunedCount,
  CATEGORIES,
  CATEGORY_LABELS,
  fromUnit,
  toUnit,
  type Category,
  type Item,
  type WeightUnit,
} from '../../domain/inventory';
import { editInventory, setItem } from './inventoryHooks';

const MAX_UNIT_WEIGHT = 10_000;

export function ItemEditor({ item, items, unit, onClose }: { item: Item; items: Item[]; unit: WeightUnit; onClose: () => void }) {
  const categoryId = useId();
  const containerId = useId();
  const set = (patch: Partial<Item>) => setItem(item.id, patch);
  const containers = items.filter((i) => i.isContainer && i.id !== item.id);
  const attunementFull = attunedCount(items) >= ATTUNEMENT_LIMIT && !item.attuned;
  const hasContents = items.some((i) => i.containerId === item.id);

  const remove = () =>
    editInventory((inv) => ({
      ...inv,
      // What was inside a removed container stays in the inventory, loose.
      items: inv.items.filter((i) => i.id !== item.id).map((i) => (i.containerId === item.id ? { ...i, containerId: null } : i)),
    }));

  return (
    <fieldset className="plain attack-edit">
      <legend className="visually-hidden">Modifica {item.name}</legend>
      <div className="form-grid">
        <TextField label="Nome" value={item.name} maxLength={80} onChange={(name) => set({ name })} />
        <div className="field">
          <label htmlFor={categoryId}>Categoria</label>
          <select id={categoryId} value={item.category} onChange={(e) => set({ category: e.target.value as Category })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <NumberField label="Quantità" value={item.quantity} min={0} max={100_000} onCommit={(quantity) => set({ quantity })} />
        <NumberField
          label={`Peso unitario (${unit})`}
          value={toUnit(item.weightLb, unit)}
          min={0}
          max={MAX_UNIT_WEIGHT}
          decimals={2}
          onCommit={(w) => set({ weightLb: Math.round(fromUnit(w, unit) * 100) / 100 })}
        />
        <NumberField
          label="Valore unitario (mo)"
          value={item.valueCp / 100}
          min={0}
          max={10_000_000}
          decimals={2}
          onCommit={(gp) => set({ valueCp: Math.round(gp * 100) })}
        />
        {!item.isContainer && containers.length > 0 && (
          <div className="field">
            <label htmlFor={containerId}>Dove si trova</label>
            <select id={containerId} value={item.containerId ?? ''} onChange={(e) => set({ containerId: e.target.value || null })}>
              <option value="">Addosso (in nessun contenitore)</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  In: {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <TextField label="Note" value={item.notes} maxLength={500} onChange={(notes) => set({ notes })} />
      <div className="row">
        <label className="inline">
          <input type="checkbox" checked={item.equipped} onChange={(e) => set({ equipped: e.target.checked })} />
          Equipaggiato
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={item.requiresAttunement}
            onChange={(e) => set({ requiresAttunement: e.target.checked, attuned: e.target.checked && item.attuned })}
          />
          Richiede sintonia
        </label>
        {item.requiresAttunement && (
          <label className="inline">
            <input
              type="checkbox"
              checked={item.attuned}
              disabled={attunementFull}
              onChange={(e) => set({ attuned: e.target.checked })}
            />
            Sintonizzato
          </label>
        )}
        <label className="inline">
          <input
            type="checkbox"
            checked={item.isContainer}
            onChange={(e) =>
              editInventory((inv) => ({
                ...inv,
                items: inv.items.map((i) => {
                  if (i.id === item.id)
                    return e.target.checked
                      ? { ...i, isContainer: true, containerId: null }
                      : { ...i, isContainer: false, containerCapacityLb: null, weightlessContents: false };
                  // A container no more: its contents come out.
                  return !e.target.checked && i.containerId === item.id ? { ...i, containerId: null } : i;
                }),
              }))
            }
          />
          È un contenitore
        </label>
      </div>
      {attunementFull && item.requiresAttunement && (
        <p className="small muted">Sei già sintonizzato con {ATTUNEMENT_LIMIT} oggetti: togli la sintonia da uno per usare questo.</p>
      )}
      {item.isContainer && (
        <div className="row">
          <NumberField
            label={`Capacità (${unit}, 0 = nessun limite)`}
            value={toUnit(item.containerCapacityLb ?? 0, unit)}
            min={0}
            max={MAX_UNIT_WEIGHT}
            decimals={2}
            onCommit={(c) => set({ containerCapacityLb: c > 0 ? Math.round(fromUnit(c, unit) * 100) / 100 : null })}
          />
          <label className="inline">
            <input type="checkbox" checked={item.weightlessContents} onChange={(e) => set({ weightlessContents: e.target.checked })} />
            Il contenuto non pesa (es. borsa conservante)
          </label>
        </div>
      )}
      <div className="row">
        <button type="button" className="primary" onClick={onClose}>
          Fatto
        </button>
        <button type="button" className="danger" onClick={remove}>
          Elimina «{item.name}»{hasContents ? ' (il contenuto resta)' : ''}
        </button>
      </div>
    </fieldset>
  );
}
