import { useState, useEffect, useCallback } from 'react';
import { Package, Clock, Minus, X, AlertTriangle, Gift, Search, RefreshCw, Plus, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from './Toast';
import { GiveawayItem, GiveawayTransaction } from './GiveawayInventory/types';
import { ItemFormModal } from './GiveawayInventory/ItemFormModal';
import { TakeItemModal } from './GiveawayInventory/TakeItemModal';

type FormState = { mode: 'add' } | { mode: 'edit'; item: GiveawayItem } | null;

export function GiveawayInventory() {
  const { isAdmin, salesPerson } = useAuth();
  const [items, setItems] = useState<GiveawayItem[]>([]);
  const [transactions, setTransactions] = useState<GiveawayTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [takeItem, setTakeItem] = useState<GiveawayItem | null>(null);
  const [formState, setFormState] = useState<FormState>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const fetchTransactions = useCallback(async () => {
    const { data, error: transErr } = await supabase
      .from('giveaway_transactions')
      .select('*')
      .order('taken_at', { ascending: false })
      .limit(50);
    if (transErr) {
      setError('Failed to load transaction history.');
      return;
    }
    setTransactions((data ?? []) as GiveawayTransaction[]);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: itemsErr } = await supabase.from('giveaway_items').select('*').order('item_name');
    if (itemsErr) {
      setError('Failed to load inventory items.');
      setLoading(false);
      return;
    }
    setItems((data ?? []) as GiveawayItem[]);
    await fetchTransactions();
    setLoading(false);
  }, [fetchTransactions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaved = (saved: GiveawayItem, isNew: boolean) => {
    setItems(prev => {
      const next = isNew ? [...prev, saved] : prev.map(i => (i.id === saved.id ? saved : i));
      return next.sort((a, b) => a.item_name.localeCompare(b.item_name));
    });
    setFormState(null);
    setToast(isNew ? `"${saved.item_name}" was added to inventory.` : `"${saved.item_name}" was updated.`);
  };

  const handleTaken = (itemId: string, newQuantity: number) => {
    const taken = items.find(i => i.id === itemId);
    const amount = taken ? taken.current_quantity - newQuantity : 0;
    setItems(prev => prev.map(i => (i.id === itemId ? { ...i, current_quantity: newQuantity } : i)));
    setTakeItem(null);
    if (taken) setToast(`You took ${amount} ${taken.unit} of ${taken.item_name}.`);
    fetchTransactions();
  };

  const getStockBadge = (qty: number) => {
    if (qty === 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Out of Stock</span>;
    if (qty <= 5) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Low Stock</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">In Stock</span>;
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const term = searchTerm.toLowerCase();
  const filteredItems = items.filter(item =>
    item.item_name.toLowerCase().includes(term) || (item.category || '').toLowerCase().includes(term)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
        <span className="ml-3 text-slate-500">Loading inventory...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <Toast message={toast} type="success" onClose={clearToast} />}

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={fetchData} className="ml-auto text-xs font-medium underline hover:text-red-800">Retry</button>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Giveaway Item Inventory</h2>
            <p className="text-sm text-slate-500">{items.length} items tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              aria-label="Search items"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full sm:w-64 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => setFormState({ mode: 'add' })}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm hover:shadow transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
          <Package className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-700">Current Inventory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Item Name</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider hidden sm:table-cell">Category</th>
                <th className="text-center px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Qty</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Unit</th>
                <th className="text-center px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="text-center px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    {searchTerm ? 'No items match your search.' : 'No inventory items found.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800">{item.item_name}</div>
                      {item.notes && <div className="text-xs text-slate-400 mt-0.5 hidden lg:block">{item.notes}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden sm:table-cell">{item.category || '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`font-semibold tabular-nums ${item.current_quantity === 0 ? 'text-red-600' : item.current_quantity <= 5 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {item.current_quantity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 hidden md:table-cell">{item.unit}</td>
                    <td className="px-5 py-3.5 text-center hidden sm:table-cell">{getStockBadge(item.current_quantity)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setTakeItem(item)}
                          disabled={item.current_quantity === 0}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                          Take
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setFormState({ mode: 'edit', item })}
                            aria-label={`Edit ${item.item_name}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">{isAdmin ? 'Transaction History' : 'My History'}</h3>
          <span className="ml-auto text-xs text-slate-400">{transactions.length} recent</span>
        </div>
        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              {isAdmin
                ? 'No transactions yet. Take some items to see them logged here.'
                : "You haven't taken any items yet. Items you take will appear here."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Date/Time</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Taken By</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Item</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Qty Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{formatTime(t.taken_at)}</td>
                    <td className="px-5 py-3 font-medium text-slate-700">{t.user_name}</td>
                    <td className="px-5 py-3 text-slate-600">{t.item_name}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold text-xs">
                        -{t.quantity_taken}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {takeItem && (
        <TakeItemModal
          item={takeItem}
          defaultName={salesPerson?.name ?? ''}
          onClose={() => setTakeItem(null)}
          onTaken={handleTaken}
        />
      )}

      {formState && isAdmin && (
        <ItemFormModal
          item={formState.mode === 'edit' ? formState.item : null}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
