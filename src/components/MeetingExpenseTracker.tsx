import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, DollarSign, Receipt, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { formatCurrency } from '../lib/budgetUtils';
import { formatDateShort, getTodayDateString } from '../lib/dateUtils';

interface Entry {
  id: string;
  amount: number;
  date?: string | null;
  description?: string | null;
}

type TableName = 'meeting_expenses' | 'meeting_expense_receipts';
type DetailKey = 'description' | 'date';

interface MeetingExpenseTrackerProps {
  meetingId: string;
  canEdit: boolean;
}

function entriesTotal(entries: Entry[]): number {
  return entries.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0);
}

export function MeetingExpenseTracker({ meetingId, canEdit }: MeetingExpenseTrackerProps) {
  const { user } = useAuth();
  const dialog = useDialog();
  const [expenses, setExpenses] = useState<Entry[]>([]);
  const [receipts, setReceipts] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      const [expRes, recRes] = await Promise.all([
        supabase
          .from('meeting_expenses')
          .select('id, amount, description, date')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: true }),
        supabase
          .from('meeting_expense_receipts')
          .select('id, amount, date')
          .eq('meeting_id', meetingId)
          .order('date', { ascending: false }),
      ]);

      if (!active) return;

      if (expRes.error || recRes.error) {
        console.error('Error loading meeting expenses:', expRes.error ?? recRes.error);
        setError('Failed to load expenses. Please try again.');
        setLoading(false);
        return;
      }

      setExpenses((expRes.data ?? []) as Entry[]);
      setReceipts((recRes.data ?? []) as Entry[]);
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [meetingId]);

  const setterFor = (table: TableName) =>
    table === 'meeting_expenses' ? setExpenses : setReceipts;

  const addEntry = async (table: TableName, detailKey: DetailKey, amount: number, detail: string) => {
    const { data, error: insertError } = await supabase
      .from(table)
      .insert({ meeting_id: meetingId, amount, [detailKey]: detail, created_by: user?.id ?? null })
      .select('id, amount, description, date')
      .single();

    if (insertError || !data) {
      console.error('Error adding entry:', insertError);
      await dialog.alert('Failed to save. Please try again.');
      return false;
    }

    setterFor(table)((prev) => [...prev, data as Entry]);
    return true;
  };

  const updateEntry = async (table: TableName, detailKey: DetailKey, id: string, amount: number, detail: string) => {
    const { data, error: updateError } = await supabase
      .from(table)
      .update({ amount, [detailKey]: detail })
      .eq('id', id)
      .select('id, amount, description, date')
      .single();

    if (updateError || !data) {
      console.error('Error updating entry:', updateError);
      await dialog.alert('Failed to update. Please try again.');
      return false;
    }

    setterFor(table)((prev) => prev.map((e) => (e.id === id ? (data as Entry) : e)));
    return true;
  };

  const deleteEntry = async (table: TableName, id: string) => {
    const confirmed = await dialog.confirm('Delete this entry? This cannot be undone.');
    if (!confirmed) return;

    const { error: deleteError } = await supabase.from(table).delete().eq('id', id);
    if (deleteError) {
      console.error('Error deleting entry:', deleteError);
      await dialog.alert('Failed to delete. Please try again.');
      return;
    }

    setterFor(table)((prev) => prev.filter((e) => e.id !== id));
  };

  const total = entriesTotal(expenses) + entriesTotal(receipts);

  if (loading) {
    return <p className="mt-3 text-sm text-slate-500">Loading expenses…</p>;
  }

  if (error) {
    return <p className="mt-3 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="mt-3 p-4 bg-white border-2 border-blue-200 rounded-lg space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Itemized Expenses &amp; Receipts
          </h4>
          {canEdit && (
            <p className="mt-0.5 text-xs text-slate-500">
              Add as many expenses as needed — each line is saved individually.
            </p>
          )}
        </div>
      </div>

      <EntrySection
        title="Expenses"
        icon={<Wallet className="w-4 h-4" />}
        items={expenses}
        canEdit={canEdit}
        field={{ label: 'Description', inputType: 'text', placeholder: 'What was this for?' }}
        detailOf={(e) => e.description ?? ''}
        formatDetail={(value) => value || '—'}
        onAdd={(amount, detail) => addEntry('meeting_expenses', 'description', amount, detail)}
        onUpdate={(id, amount, detail) => updateEntry('meeting_expenses', 'description', id, amount, detail)}
        onDelete={(id) => deleteEntry('meeting_expenses', id)}
      />

      <EntrySection
        title="Receipts"
        icon={<Receipt className="w-4 h-4" />}
        items={receipts}
        canEdit={canEdit}
        field={{ label: 'Date', inputType: 'date', defaultValue: getTodayDateString }}
        detailOf={(e) => e.date ?? ''}
        formatDetail={(value) => (value ? formatDateShort(value) : '—')}
        onAdd={(amount, detail) => addEntry('meeting_expense_receipts', 'date', amount, detail)}
        onUpdate={(id, amount, detail) => updateEntry('meeting_expense_receipts', 'date', id, amount, detail)}
        onDelete={(id) => deleteEntry('meeting_expense_receipts', id)}
      />

      <div className="flex items-center justify-between pt-3 border-t border-slate-300">
        <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
          <DollarSign className="w-4 h-4" />
          Total Meeting Expense
        </span>
        <span className="text-lg font-bold text-slate-900">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

interface FieldConfig {
  label: string;
  inputType: 'text' | 'date';
  placeholder?: string;
  defaultValue?: () => string;
}

interface EntrySectionProps {
  title: string;
  icon: React.ReactNode;
  items: Entry[];
  canEdit: boolean;
  field: FieldConfig;
  detailOf: (entry: Entry) => string;
  formatDetail: (value: string) => string;
  onAdd: (amount: number, detail: string) => Promise<boolean>;
  onUpdate: (id: string, amount: number, detail: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}

function EntrySection({
  title,
  icon,
  items,
  canEdit,
  field,
  detailOf,
  formatDetail,
  onAdd,
  onUpdate,
  onDelete,
}: EntrySectionProps) {
  const defaultDetail = () => (field.defaultValue ? field.defaultValue() : '');
  const [showAdd, setShowAdd] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newDetail, setNewDetail] = useState(defaultDetail);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [busy, setBusy] = useState(false);

  const sectionTotal = entriesTotal(items);

  const validAmount = (value: string) => {
    const n = parseFloat(value);
    return !Number.isNaN(n) && n > 0;
  };
  const validDetail = (value: string) => value.trim().length > 0;

  const resetAdd = () => {
    setShowAdd(false);
    setNewAmount('');
    setNewDetail(defaultDetail());
  };

  const confirmAdd = async () => {
    if (!validAmount(newAmount) || !validDetail(newDetail)) return;
    setBusy(true);
    const ok = await onAdd(parseFloat(newAmount), newDetail.trim());
    setBusy(false);
    if (ok) resetAdd();
  };

  const startEdit = (entry: Entry) => {
    setEditingId(entry.id);
    setEditAmount(entry.amount.toString());
    setEditDetail(detailOf(entry));
  };

  const confirmEdit = async () => {
    if (!editingId || !validAmount(editAmount) || !validDetail(editDetail)) return;
    setBusy(true);
    const ok = await onUpdate(editingId, parseFloat(editAmount), editDetail.trim());
    setBusy(false);
    if (ok) setEditingId(null);
  };

  const detailInputClass =
    'w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-sm font-semibold text-slate-700">
          {icon}
          {title}
        </p>
        {canEdit && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add {title.slice(0, -1)}
          </button>
        )}
      </div>

      <div className="overflow-hidden border border-slate-200 rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
              <th className="text-left font-semibold px-3 py-2">{field.label}</th>
              <th className="text-right font-semibold px-3 py-2 w-28">Amount</th>
              {canEdit && <th className="px-3 py-2 w-20" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !showAdd && (
              <tr>
                <td colSpan={canEdit ? 3 : 2} className="px-3 py-3 text-center text-xs text-slate-400">
                  No {title.toLowerCase()} added.
                </td>
              </tr>
            )}

            {items.map((entry) => (
              <tr key={entry.id} className="border-t border-slate-100">
                {editingId === entry.id ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type={field.inputType}
                        value={editDetail}
                        placeholder={field.placeholder}
                        onChange={(e) => setEditDetail(e.target.value)}
                        className={detailInputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full pl-5 pr-2 py-1.5 border border-slate-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={confirmEdit}
                          disabled={busy || !validAmount(editAmount) || !validDetail(editDetail)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-slate-700">{formatDetail(detailOf(entry))}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {formatCurrency(entry.amount)}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(entry)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(entry.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}

            {showAdd && (
              <tr className="border-t border-slate-100 bg-blue-50">
                <td className="px-3 py-2">
                  <input
                    type={field.inputType}
                    autoFocus
                    value={newDetail}
                    placeholder={field.placeholder}
                    onChange={(e) => setNewDetail(e.target.value)}
                    className={detailInputClass}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newAmount}
                      placeholder="0.00"
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="w-full pl-5 pr-2 py-1.5 border border-slate-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={confirmAdd}
                      disabled={busy || !validAmount(newAmount) || !validDetail(newDetail)}
                      className="p-1.5 text-green-600 hover:bg-green-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Add"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={resetAdd}
                      className="p-1.5 text-slate-500 hover:bg-slate-200 rounded"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Subtotal
              </td>
              <td className="px-3 py-2 text-right font-bold text-slate-900">
                {formatCurrency(sectionTotal)}
              </td>
              {canEdit && <td className="px-3 py-2" />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
