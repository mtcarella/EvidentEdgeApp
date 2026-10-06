export interface GiveawayItem {
  id: string;
  item_name: string;
  category: string | null;
  current_quantity: number;
  unit: string;
  notes: string | null;
  created_at: string;
}

export interface GiveawayTransaction {
  id: string;
  item_id: string | null;
  item_name: string;
  quantity_taken: number;
  user_name: string;
  taken_at: string;
}

export const inputClass =
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all';

export const fieldClass = (hasError: boolean) =>
  `${inputClass} ${hasError ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-slate-200 focus:ring-teal-500/20 focus:border-teal-400'}`;

export const labelClass = 'block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5';
