import { useState, FormEvent } from 'react';
import { RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from './Modal';
import { GiveawayItem, fieldClass, labelClass } from './types';

interface TakeItemModalProps {
  item: GiveawayItem;
  defaultName: string;
  onClose: () => void;
  onTaken: (itemId: string, newQuantity: number) => void;
}

export function TakeItemModal({ item, defaultName, onClose, onTaken }: TakeItemModalProps) {
  const max = item.current_quantity;
  const [qtyText, setQtyText] = useState('1');
  const [notice, setNotice] = useState<string | null>(null);
  const [userName, setUserName] = useState(defaultName);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const qty = qtyText === '' ? 0 : Number(qtyText);
  const qtyValid = qty >= 1 && qty <= max;
  const remaining = max - qty;

  const handleQtyChange = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '');
    if (digits === '') {
      setQtyText('');
      setNotice(null);
      return;
    }
    const n = Number(digits);
    if (n > max) {
      setQtyText(String(max));
      setNotice(`Maximum available is ${max}. Your entry was adjusted.`);
    } else if (n < 1) {
      setQtyText('1');
      setNotice('Minimum is 1. Your entry was adjusted.');
    } else {
      setQtyText(String(n));
      setNotice(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!qtyValid || !userName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    const { data, error } = await supabase.rpc('take_giveaway_item', {
      p_item_id: item.id,
      p_quantity: qty,
      p_user_name: userName.trim(),
    });

    setSubmitting(false);
    if (error || typeof data !== 'number') {
      setSubmitError(
        error?.message?.includes('Not enough stock')
          ? 'Someone just took some of this item and there is no longer enough in stock. Please refresh and try a smaller amount.'
          : 'We could not complete this request. Please try again.'
      );
      return;
    }
    onTaken(item.id, data);
  };

  return (
    <Modal
      title="Take Items"
      onClose={onClose}
      disableClose={submitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="giveaway-take-form"
            disabled={submitting || !qtyValid || !userName.trim()}
            className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Confirming...' : 'Confirm'}
          </button>
        </>
      }
    >
      <form id="giveaway-take-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {submitError && (
          <div role="alert" className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {submitError}
          </div>
        )}

        <div>
          <span className={labelClass}>Item</span>
          <div className="text-base font-semibold text-slate-800">{item.item_name}</div>
          <div className="text-sm text-slate-500 mt-0.5">
            Available: <span className="font-medium text-slate-700">{max} {item.unit}</span>
          </div>
        </div>

        <div>
          <label htmlFor="take-qty" className={labelClass}>Quantity to Take</label>
          <input
            id="take-qty"
            data-autofocus
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={qtyText}
            onChange={e => handleQtyChange(e.target.value)}
            onFocus={e => e.target.select()}
            placeholder={`1 - ${max}`}
            aria-describedby="take-qty-help"
            aria-invalid={qtyText !== '' && !qtyValid}
            className={fieldClass(qtyText === '')}
          />
          <div id="take-qty-help" aria-live="polite" className="mt-1.5 min-h-[18px]">
            {notice ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <Info className="w-3.5 h-3.5" />
                {notice}
              </p>
            ) : qtyText === '' ? (
              <p className="text-xs text-red-600">Please enter a quantity of at least 1.</p>
            ) : (
              <p className="text-xs text-slate-400">Enter any amount from 1 to {max}.</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="take-name" className={labelClass}>Your Name</label>
          <input
            id="take-name"
            type="text"
            value={userName}
            maxLength={100}
            onChange={e => setUserName(e.target.value)}
            placeholder="Enter your name"
            className={fieldClass(false)}
          />
        </div>

        {qtyValid && remaining > 0 && remaining <= 5 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            This will bring stock to a low level ({remaining} remaining).
          </div>
        )}

        {qtyValid && remaining === 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            This will use up all remaining stock for this item.
          </div>
        )}
      </form>
    </Modal>
  );
}
