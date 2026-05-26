import { useState, useEffect, useRef, useCallback } from 'react';
import { DollarSign, Check, Loader2, AlertCircle, RefreshCw, PlusCircle, Undo2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface BudgetUser {
  id: string;
  name: string;
  budget: number;
  updated_at: string | null;
}

type RowStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UndoEntry {
  userId: string;
  previousBudget: number;
  addedAmount: number;
  timer: ReturnType<typeof setTimeout>;
}

export function BudgetManagement() {
  const { refreshSalesPerson } = useAuth();
  const [users, setUsers] = useState<BudgetUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowStatuses, setRowStatuses] = useState<Record<string, RowStatus>>({});
  const [addFundsInputs, setAddFundsInputs] = useState<Record<string, string>>({});
  const [addFundsErrors, setAddFundsErrors] = useState<Record<string, string>>({});
  const [addFundsOpen, setAddFundsOpen] = useState<Record<string, boolean>>({});
  const [undoEntries, setUndoEntries] = useState<Record<string, UndoEntry>>({});
  const [focusedBudgetId, setFocusedBudgetId] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    loadUsers();
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
      Object.values(savedTimers.current).forEach(clearTimeout);
      Object.values(undoEntries).forEach(entry => clearTimeout(entry.timer));
    };
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales_people')
      .select('id, name, budget, updated_at')
      .eq('budget_display_enabled', true)
      .order('name');

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const setStatus = useCallback((userId: string, status: RowStatus) => {
    setRowStatuses(prev => ({ ...prev, [userId]: status }));

    if (status === 'saved') {
      if (savedTimers.current[userId]) clearTimeout(savedTimers.current[userId]);
      savedTimers.current[userId] = setTimeout(() => {
        setRowStatuses(prev => ({ ...prev, [userId]: 'idle' }));
      }, 2000);
    }
  }, []);

  const saveBudget = useCallback(async (userId: string, budget: number) => {
    setStatus(userId, 'saving');

    const { data, error } = await supabase
      .from('sales_people')
      .update({ budget })
      .eq('id', userId)
      .select('updated_at')
      .maybeSingle();

    if (error) {
      console.error('Budget save error:', error);
      setStatus(userId, 'error');
      return false;
    } else {
      if (data) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, updated_at: data.updated_at } : u));
      }
      setStatus(userId, 'saved');
      refreshSalesPerson();
      return true;
    }
  }, [setStatus, refreshSalesPerson]);

  const handleBudgetChange = useCallback((userId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, budget: numValue } : u));

    if (debounceTimers.current[userId]) {
      clearTimeout(debounceTimers.current[userId]);
    }

    debounceTimers.current[userId] = setTimeout(() => {
      saveBudget(userId, numValue);
    }, 700);
  }, [saveBudget]);

  const validateAddFunds = (value: string): string | null => {
    if (!value.trim()) return 'Enter an amount';
    const num = parseFloat(value);
    if (isNaN(num)) return 'Must be a number';
    if (num <= 0) return 'Must be greater than $0';
    if (num > 100000) return 'Amount too large';
    return null;
  };

  const handleAddFunds = useCallback(async (userId: string) => {
    const inputValue = addFundsInputs[userId] || '';
    const validationError = validateAddFunds(inputValue);
    if (validationError) {
      setAddFundsErrors(prev => ({ ...prev, [userId]: validationError }));
      return;
    }

    const amount = parseFloat(inputValue);
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const previousBudget = parseFloat(String(user.budget)) || 0;
    const newBudget = Math.round((previousBudget + amount) * 100) / 100;

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, budget: newBudget } : u));

    const success = await saveBudget(userId, newBudget);

    if (success) {
      setAddFundsInputs(prev => ({ ...prev, [userId]: '' }));
      setAddFundsErrors(prev => ({ ...prev, [userId]: '' }));
      setAddFundsOpen(prev => ({ ...prev, [userId]: false }));

      if (undoEntries[userId]) {
        clearTimeout(undoEntries[userId].timer);
      }

      const timer = setTimeout(() => {
        setUndoEntries(prev => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }, 12000);

      setUndoEntries(prev => ({
        ...prev,
        [userId]: { userId, previousBudget, addedAmount: amount, timer },
      }));
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, budget: previousBudget } : u));
    }
  }, [addFundsInputs, users, saveBudget, undoEntries]);

  const handleUndo = useCallback(async (userId: string) => {
    const entry = undoEntries[userId];
    if (!entry) return;

    clearTimeout(entry.timer);

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, budget: entry.previousBudget } : u));
    await saveBudget(userId, entry.previousBudget);

    setUndoEntries(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, [undoEntries, saveBudget]);

  const handleAddFundsInputChange = (userId: string, value: string) => {
    setAddFundsInputs(prev => ({ ...prev, [userId]: value }));
    if (addFundsErrors[userId]) {
      setAddFundsErrors(prev => ({ ...prev, [userId]: '' }));
    }
  };

  const handleAddFundsKeyDown = (e: React.KeyboardEvent, userId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFunds(userId);
    } else if (e.key === 'Escape') {
      setAddFundsOpen(prev => ({ ...prev, [userId]: false }));
      setAddFundsInputs(prev => ({ ...prev, [userId]: '' }));
      setAddFundsErrors(prev => ({ ...prev, [userId]: '' }));
    }
  };

  const getPreviewTotal = (userId: string): number | null => {
    const inputValue = addFundsInputs[userId];
    if (!inputValue || !inputValue.trim()) return null;
    const amount = parseFloat(inputValue);
    if (isNaN(amount) || amount <= 0) return null;
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    const currentBudget = parseFloat(String(user.budget)) || 0;
    return Math.round((currentBudget + amount) * 100) / 100;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <DollarSign className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="text-lg font-medium">No users with budget display enabled</p>
        <p className="text-sm mt-1">Enable budget display for users in the Admin Panel to manage their budgets here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-semibold text-slate-900">Budget Management</h2>
        <span className="text-sm text-slate-500 ml-auto">{users.length} user{users.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Budget</th>
              <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Add Funds</th>
              <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Updated</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const status = rowStatuses[user.id] || 'idle';
              const isAddOpen = addFundsOpen[user.id] || false;
              const addInput = addFundsInputs[user.id] || '';
              const addError = addFundsErrors[user.id] || '';
              const previewTotal = getPreviewTotal(user.id);
              const undoEntry = undoEntries[user.id];

              return (
                <tr key={user.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-5">
                    <span className="font-medium text-slate-800">{user.name}</span>
                  </td>
                  <td className="py-3 px-5">
                    <div className="relative w-40">
                      {focusedBudgetId === user.id ? (
                        <>
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={user.budget}
                            onChange={(e) => handleBudgetChange(user.id, e.target.value)}
                            onBlur={() => setFocusedBudgetId(null)}
                            autoFocus
                            className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all outline-none"
                          />
                        </>
                      ) : (
                        <button
                          onClick={() => setFocusedBudgetId(user.id)}
                          className={`w-full text-left pl-3 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-all cursor-text ${
                            user.budget < 0 ? 'text-red-600 font-medium' : 'text-slate-800'
                          }`}
                        >
                          {formatCurrency(user.budget)}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex flex-col gap-1">
                      {!isAddOpen ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setAddFundsOpen(prev => ({ ...prev, [user.id]: true }))}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Add Funds
                          </button>
                          {undoEntry && (
                            <button
                              onClick={() => handleUndo(user.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors animate-pulse"
                              title={`Undo +${formatCurrency(undoEntry.addedAmount)}`}
                            >
                              <Undo2 className="w-3 h-3" />
                              Undo +{formatCurrency(undoEntry.addedAmount)}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600 text-sm font-medium">+$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={addInput}
                                onChange={(e) => handleAddFundsInputChange(user.id, e.target.value)}
                                onKeyDown={(e) => handleAddFundsKeyDown(e, user.id)}
                                autoFocus
                                className={`w-28 pl-8 pr-2 py-1.5 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all outline-none ${
                                  addError ? 'border-red-300' : 'border-slate-200'
                                }`}
                              />
                            </div>
                            <button
                              onClick={() => handleAddFunds(user.id)}
                              className="px-2.5 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => {
                                setAddFundsOpen(prev => ({ ...prev, [user.id]: false }));
                                setAddFundsInputs(prev => ({ ...prev, [user.id]: '' }));
                                setAddFundsErrors(prev => ({ ...prev, [user.id]: '' }));
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {addError && (
                            <span className="text-xs text-red-600">{addError}</span>
                          )}
                          {previewTotal !== null && (
                            <span className="text-xs text-emerald-600 font-medium">
                              New Total: {formatCurrency(previewTotal)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-5 text-sm text-slate-500">
                    {formatDate(user.updated_at)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      {status === 'saving' && (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                      )}
                      {status === 'saved' && (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                      {status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
