import { useState, useEffect, useCallback } from 'react';
import { Package, Clock, Minus, X, AlertTriangle, Gift, Search, RefreshCw, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface GiveawayItem {
  id: string;
  item_name: string;
  category: string | null;
  current_quantity: number;
  unit: string;
  notes: string | null;
  created_at: string;
}

interface GiveawayTransaction {
  id: string;
  item_id: string | null;
  item_name: string;
  quantity_taken: number;
  user_name: string;
  taken_at: string;
}

export function GiveawayInventory() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<GiveawayItem[]>([]);
  const [transactions, setTransactions] = useState<GiveawayTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustItem, setAdjustItem] = useState<GiveawayItem | null>(null);
  const [quantityToTake, setQuantityToTake] = useState(1);
  const [userName, setUserName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(0);
  const [newItemUnit, setNewItemUnit] = useState('pieces');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [itemsRes, transRes] = await Promise.all([
      supabase.from('giveaway_items').select('*').order('item_name'),
      supabase.from('giveaway_transactions').select('*').order('taken_at', { ascending: false }).limit(50),
    ]);
    if (itemsRes.error) {
      setError('Failed to load inventory items.');
      setLoading(false);
      return;
    }
    if (transRes.error) {
      setError('Failed to load transaction history.');
      setLoading(false);
      return;
    }
    setItems(itemsRes.data as GiveawayItem[]);
    setTransactions(transRes.data as GiveawayTransaction[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAdjustModal = (item: GiveawayItem) => {
    setAdjustItem(item);
    setQuantityToTake(1);
    setUserName('');
  };

  const handleConfirm = async () => {
    if (!adjustItem || !userName.trim() || quantityToTake < 1) return;
    setSubmitting(true);

    const newQuantity = adjustItem.current_quantity - quantityToTake;
    const { error: updateErr } = await supabase
      .from('giveaway_items')
      .update({ current_quantity: newQuantity })
      .eq('id', adjustItem.id);

    if (updateErr) {
      setError('Failed to update inventory.');
      setSubmitting(false);
      return;
    }

    const { error: insertErr } = await supabase.from('giveaway_transactions').insert({
      item_id: adjustItem.id,
      item_name: adjustItem.item_name,
      quantity_taken: quantityToTake,
      user_name: userName.trim(),
    });

    if (insertErr) {
      setError('Failed to log transaction.');
      setSubmitting(false);
      return;
    }

    setAdjustItem(null);
    setSubmitting(false);
    fetchData();
  };

  const getStockBadge = (qty: number) => {
    if (qty === 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Out of Stock</span>;
    if (qty <= 5) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Low Stock</span>;
    return null;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleAddItem = async () => {
    if (!newItemName.trim() || newItemQuantity < 0) return;
    setSubmitting(true);

    const { error: insertErr } = await supabase.from('giveaway_items').insert({
      item_name: newItemName.trim(),
      current_quantity: newItemQuantity,
      unit: newItemUnit.trim() || 'pieces',
      category: newItemCategory.trim() || null,
      notes: newItemNotes.trim() || null,
    });

    if (insertErr) {
      setError('Failed to add item.');
      setSubmitting(false);
      return;
    }

    setShowAddModal(false);
    setNewItemName('');
    setNewItemQuantity(0);
    setNewItemUnit('pieces');
    setNewItemCategory('');
    setNewItemNotes('');
    setSubmitting(false);
    fetchData();
  };

  const filteredItems = items.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const maxDropdown = adjustItem ? Math.min(50, adjustItem.current_quantity) : 0;

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
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full sm:w-64 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>
      </div>

      {/* Inventory Table */}
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
                <th className="text-center px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
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
                    <td className="px-5 py-3.5 text-center">{getStockBadge(item.current_quantity)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => openAdjustModal(item)}
                        disabled={item.current_quantity === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                        Take
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Transaction History</h3>
          <span className="ml-auto text-xs text-slate-400">{transactions.length} recent</span>
        </div>
        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              No transactions yet. Take some items to see them logged here.
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

      {/* Adjust Modal */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setAdjustItem(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-emerald-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Take Items</h3>
                <button
                  onClick={() => !submitting && setAdjustItem(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Item</label>
                <div className="text-base font-semibold text-slate-800">{adjustItem.item_name}</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  Available: <span className="font-medium text-slate-700">{adjustItem.current_quantity} {adjustItem.unit}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Quantity to Take</label>
                <select
                  value={quantityToTake}
                  onChange={e => setQuantityToTake(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                >
                  {Array.from({ length: maxDropdown }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                />
              </div>

              {adjustItem.current_quantity - quantityToTake <= 5 && adjustItem.current_quantity - quantityToTake > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  This will bring stock to a low level ({adjustItem.current_quantity - quantityToTake} remaining).
                </div>
              )}

              {adjustItem.current_quantity - quantityToTake === 0 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  This will deplete all remaining stock for this item.
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                onClick={() => setAdjustItem(null)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || !userName.trim() || quantityToTake < 1}
                className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-emerald-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Add New Item</h3>
                <button
                  onClick={() => !submitting && setShowAddModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Item Name *</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="e.g. Branded Tote Bag"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={newItemQuantity}
                    onChange={e => setNewItemQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Unit</label>
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={e => setNewItemUnit(e.target.value)}
                    placeholder="pieces"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Category (optional)</label>
                <input
                  type="text"
                  value={newItemCategory}
                  onChange={e => setNewItemCategory(e.target.value)}
                  placeholder="e.g. Apparel, Office, Promotional"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
                <input
                  type="text"
                  value={newItemNotes}
                  onChange={e => setNewItemNotes(e.target.value)}
                  placeholder="Size, color, or other details"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={submitting || !newItemName.trim()}
                className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
