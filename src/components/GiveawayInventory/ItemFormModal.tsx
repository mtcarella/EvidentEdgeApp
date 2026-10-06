import { useState, FormEvent } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from './Modal';
import { GiveawayItem, fieldClass, labelClass } from './types';

interface ItemFormModalProps {
  item: GiveawayItem | null;
  onClose: () => void;
  onSaved: (item: GiveawayItem, isNew: boolean) => void;
}

interface FormErrors {
  name?: string;
  quantity?: string;
  unit?: string;
}

const MAX_QTY = 1_000_000;

export function ItemFormModal({ item, onClose, onSaved }: ItemFormModalProps) {
  const isEdit = item !== null;
  const [name, setName] = useState(item?.item_name ?? '');
  const [quantity, setQuantity] = useState(item ? String(item.current_quantity) : '0');
  const [unit, setUnit] = useState(item?.unit ?? 'pieces');
  const [category, setCategory] = useState(item?.category ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = 'Item name is required.';
    else if (trimmed.length > 100) next.name = 'Item name must be 100 characters or fewer.';

    if (!/^\d+$/.test(quantity.trim())) next.quantity = 'Enter a whole number of 0 or more.';
    else if (Number(quantity) > MAX_QTY) next.quantity = `Quantity cannot exceed ${MAX_QTY.toLocaleString()}.`;

    if (unit.trim().length > 30) next.unit = 'Unit must be 30 characters or fewer.';
    return next;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setSaveError(null);
    const payload = {
      item_name: name.trim(),
      current_quantity: Number(quantity),
      unit: unit.trim() || 'pieces',
      category: category.trim() || null,
      notes: notes.trim() || null,
    };

    const query = isEdit
      ? supabase.from('giveaway_items').update(payload).eq('id', item.id).select().maybeSingle()
      : supabase.from('giveaway_items').insert(payload).select().maybeSingle();
    const { data, error } = await query;

    setSaving(false);
    if (error || !data) {
      setSaveError(
        isEdit
          ? 'We could not save your changes. Please make sure you have admin access and try again.'
          : 'We could not add this item. Please make sure you have admin access and try again.'
      );
      return;
    }
    onSaved(data as GiveawayItem, !isEdit);
  };

  return (
    <Modal
      title={isEdit ? 'Edit Item' : 'Add New Item'}
      onClose={onClose}
      disableClose={saving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="giveaway-item-form"
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </>
      }
    >
      <form id="giveaway-item-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {saveError && (
          <div role="alert" className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {saveError}
          </div>
        )}

        <div>
          <label htmlFor="gi-name" className={labelClass}>Item Name *</label>
          <input
            id="gi-name"
            data-autofocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Branded Tote Bag"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'gi-name-err' : undefined}
            className={fieldClass(!!errors.name)}
          />
          {errors.name && <p id="gi-name-err" className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="gi-qty" className={labelClass}>Quantity *</label>
            <input
              id="gi-qty"
              type="text"
              inputMode="numeric"
              value={quantity}
              onChange={e => setQuantity(e.target.value.replace(/[^\d]/g, ''))}
              aria-invalid={!!errors.quantity}
              aria-describedby={errors.quantity ? 'gi-qty-err' : undefined}
              className={fieldClass(!!errors.quantity)}
            />
            {errors.quantity && <p id="gi-qty-err" className="mt-1 text-xs text-red-600">{errors.quantity}</p>}
          </div>
          <div>
            <label htmlFor="gi-unit" className={labelClass}>Unit</label>
            <input
              id="gi-unit"
              type="text"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="pieces"
              aria-invalid={!!errors.unit}
              className={fieldClass(!!errors.unit)}
            />
            {errors.unit && <p className="mt-1 text-xs text-red-600">{errors.unit}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="gi-cat" className={labelClass}>Category (optional)</label>
          <input
            id="gi-cat"
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="e.g. Apparel, Office, Promotional"
            className={fieldClass(false)}
          />
        </div>

        <div>
          <label htmlFor="gi-notes" className={labelClass}>Description (optional)</label>
          <textarea
            id="gi-notes"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Size, color, or other details"
            className={`${fieldClass(false)} resize-none`}
          />
        </div>
      </form>
    </Modal>
  );
}
