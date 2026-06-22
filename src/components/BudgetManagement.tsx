import { useState, useEffect, useRef, useCallback } from 'react';
import { DollarSign, Check, Loader2, AlertCircle, RefreshCw, PlusCircle, Undo2, X, Fuel } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BudgetType } from '../lib/budgetUtils';

type BudgetField = 'budget' | 'gas_budget';

interface BudgetUser {
  id: string;
  user_id: string;
  name: string;
  budget: number;
  gas_budget: number;
  updated_at: string | null;
}

type RowStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UndoEntry {
  userId: string;
  field: BudgetField;
  previousValue: number;
  addedAmount: number;
  timer: ReturnType<typeof setTimeout>;
}

type RowKey = `${string}:${BudgetField}`;
const rk = (userId: string, field: BudgetField): RowKey => `${userId}:${field}`;

export function BudgetManagement() {
  const { refreshSalesPerson, salesPerson } = useAuth();
  const [users, setUsers] = useState<BudgetUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowStatuses, setRowStatuses] = useState<Record<RowKey, RowStatus>>({});
  const [addFundsInputs, setAddFundsInputs] = useState<Record<RowKey, string>>({});
  const [addFundsErrors, setAddFundsErrors] = useState<Record<RowKey, string>>({});
  const [addFundsOpen, setAddFundsOpen] = useState<Record<RowKey, boolean>>({});
  const [undoEntries, setUndoEntries] = useState<Record<RowKey, UndoEntry>>({});
  const [focusedKey, setFocusedKey] = useState<RowKey | null>(null);
  const debounceTimers = useRef<Record<RowKey, ReturnType<typeof setTimeout>>>({});
  const savedTimers = useRef<Record<RowKey, ReturnType<typeof setTimeout>>>({});

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
      .select('id, user_id, name, budget, gas_budget, updated_at')
      .eq('budget_display_enabled', true)
      .order('name');

    if (!error && data) {
      setUsers(data as BudgetUser[]);
    }
    setLoading(false);
  };

  const setStatus = useCallback((key: RowKey, status: RowStatus) => {
    setRowStatuses(prev => ({ ...prev, [key]: status }));
    if (status === 'saved') {
      if (savedTimers.current[key]) clearTimeout(savedTimers.current[key]);
      savedTimers.current[key] = setTimeout(() => {
        setRowStatuses(prev => ({ ...prev, [key]: 'idle' }));
      }, 2000);
    }
  }, []);

  const notifyBudgetOwner = useCallback(async (targetUser: BudgetUser, field: BudgetField, newValue: number) => {
    if (!salesPerson || targetUser.id === salesPerson.id) return;
    const fieldLabel = field === 'gas_budget' ? 'gas budget' : 'budget';
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(newValue);
    await supabase.from('notifications').insert({
      user_id: targetUser.user_id,
      message: `${salesPerson.name} updated your ${fieldLabel} to ${formatted}.`,
      type: 'budget_edit',
      metadata: { editor_id: salesPerson.id, editor_name: salesPerson.name, field, new_value: newValue },
    });
  }, [salesPerson]);

  const logTransaction = useCallback(async (
    targetUser: BudgetUser,
    field: BudgetField,
    amount: number,
    type: 'credit' | 'debit',
    balanceAfter: number,
    description: string
  ) => {
    const budgetType: BudgetType = field === 'gas_budget' ? 'gas' : 'regular';
    try {
      await supabase.from('budget_transactions').insert({
        sales_person_id: targetUser.id,
        user_id: targetUser.user_id,
        amount,
        type,
        budget_type: budgetType,
        category: 'admin',
        description,
        balance_after: balanceAfter,
      });
    } catch (err) {
      console.error('Failed to log budget transaction:', err);
    }
  }, []);

  const saveBudget = useCallback(async (userId: string, field: BudgetField, value: number) => {
    const key = rk(userId, field);
    setStatus(key, 'saving');

    const { data, error } = await supabase
      .from('sales_people')
      .update({ [field]: value })
      .eq('id', userId)
      .select('updated_at')
      .maybeSingle();

    if (error) {
      console.error('Budget save error:', error);
      setStatus(key, 'error');
      return false;
    }
    if (data) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, updated_at: data.updated_at } : u));
    }
    setStatus(key, 'saved');
    refreshSalesPerson();
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) notifyBudgetOwner(targetUser, field, value);
    return true;
  }, [setStatus, refreshSalesPerson, users, notifyBudgetOwner]);

  const handleBudgetChange = useCallback((userId: string, field: BudgetField, valueStr: string) => {
    const numValue = parseFloat(valueStr) || 0;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: numValue } : u));

    const key = rk(userId, field);
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => saveBudget(userId, field, numValue), 700);
  }, [saveBudget]);

  const validateAddFunds = (value: string): string | null => {
    if (!value.trim()) return 'Enter an amount';
    const num = parseFloat(value);
    if (isNaN(num)) return 'Must be a number';
    if (num <= 0) return 'Must be greater than $0';
    if (num > 100000) return 'Amount too large';
    return null;
  };

  const handleAddFunds = useCallback(async (userId: string, field: BudgetField) => {
    const key = rk(userId, field);
    const inputValue = addFundsInputs[key] || '';
    const validationError = validateAddFunds(inputValue);
    if (validationError) {
      setAddFundsErrors(prev => ({ ...prev, [key]: validationError }));
      return;
    }

    const amount = parseFloat(inputValue);
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const previousValue = parseFloat(String(user[field])) || 0;
    const newValue = Math.round((previousValue + amount) * 100) / 100;

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: newValue } : u));
    const success = await saveBudget(userId, field, newValue);

    if (success) {
      setAddFundsInputs(prev => ({ ...prev, [key]: '' }));
      setAddFundsErrors(prev => ({ ...prev, [key]: '' }));
      setAddFundsOpen(prev => ({ ...prev, [key]: false }));

      const adminName = salesPerson?.name || 'Admin';
      const fieldLabel = field === 'gas_budget' ? 'gas budget' : 'budget';
      logTransaction(user, field, amount, 'credit', newValue, `${adminName} added funds to ${fieldLabel}`);

      if (undoEntries[key]) clearTimeout(undoEntries[key].timer);

      const timer = setTimeout(() => {
        setUndoEntries(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 12000);

      setUndoEntries(prev => ({
        ...prev,
        [key]: { userId, field, previousValue, addedAmount: amount, timer },
      }));
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: previousValue } : u));
    }
  }, [addFundsInputs, users, saveBudget, undoEntries, logTransaction, salesPerson]);

  const handleUndo = useCallback(async (key: RowKey) => {
    const entry = undoEntries[key];
    if (!entry) return;
    clearTimeout(entry.timer);

    const targetUser = users.find(u => u.id === entry.userId);
    setUsers(prev => prev.map(u => u.id === entry.userId ? { ...u, [entry.field]: entry.previousValue } : u));
    await saveBudget(entry.userId, entry.field, entry.previousValue);

    if (targetUser) {
      const fieldLabel = entry.field === 'gas_budget' ? 'gas budget' : 'budget';
      logTransaction(targetUser, entry.field, entry.addedAmount, 'debit', entry.previousValue, `Undo: funds removed from ${fieldLabel}`);
    }

    setUndoEntries(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [undoEntries, saveBudget, users, logTransaction]);

  const handleAddFundsInputChange = (key: RowKey, value: string) => {
    setAddFundsInputs(prev => ({ ...prev, [key]: value }));
    if (addFundsErrors[key]) {
      setAddFundsErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const handleAddFundsKeyDown = (e: React.KeyboardEvent, userId: string, field: BudgetField) => {
    const key = rk(userId, field);
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFunds(userId, field);
    } else if (e.key === 'Escape') {
      setAddFundsOpen(prev => ({ ...prev, [key]: false }));
      setAddFundsInputs(prev => ({ ...prev, [key]: '' }));
      setAddFundsErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const getPreviewTotal = (userId: string, field: BudgetField): number | null => {
    const key = rk(userId, field);
    const inputValue = addFundsInputs[key];
    if (!inputValue || !inputValue.trim()) return null;
    const amount = parseFloat(inputValue);
    if (isNaN(amount) || amount <= 0) return null;
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    const currentValue = parseFloat(String(user[field])) || 0;
    return Math.round((currentValue + amount) * 100) / 100;
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

  const renderBudgetCell = (user: BudgetUser, field: BudgetField) => {
    const key = rk(user.id, field);
    const value = parseFloat(String(user[field])) || 0;
    const isFocused = focusedKey === key;
    return (
      <div className="relative w-36">
        {isFocused ? (
          <>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              value={user[field]}
              onChange={(e) => handleBudgetChange(user.id, field, e.target.value)}
              onBlur={() => setFocusedKey(null)}
              autoFocus
              className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all outline-none"
            />
          </>
        ) : (
          <button
            onClick={() => setFocusedKey(key)}
            className={`w-full text-left pl-3 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-all cursor-text ${
              value < 0 ? 'text-red-600 font-medium' : 'text-slate-800'
            }`}
          >
            {formatCurrency(value)}
          </button>
        )}
      </div>
    );
  };

  const renderAddFundsCell = (user: BudgetUser, field: BudgetField) => {
    const key = rk(user.id, field);
    const isOpen = addFundsOpen[key] || false;
    const addInput = addFundsInputs[key] || '';
    const addError = addFundsErrors[key] || '';
    const previewTotal = getPreviewTotal(user.id, field);
    const undoEntry = undoEntries[key];
    const accent = field === 'gas_budget' ? 'amber' : 'emerald';
    const accentClasses = field === 'gas_budget'
      ? { bg: 'bg-amber-50', hoverBg: 'hover:bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', solid: 'bg-amber-600 hover:bg-amber-700', focus: 'focus:ring-amber-500/30 focus:border-amber-400', plus: 'text-amber-600' }
      : { bg: 'bg-emerald-50', hoverBg: 'hover:bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', solid: 'bg-emerald-600 hover:bg-emerald-700', focus: 'focus:ring-emerald-500/30 focus:border-emerald-400', plus: 'text-emerald-600' };

    return (
      <div className="flex flex-col gap-1">
        {!isOpen ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddFundsOpen(prev => ({ ...prev, [key]: true }))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${accentClasses.text} ${accentClasses.bg} ${accentClasses.hoverBg} border ${accentClasses.border} rounded-lg transition-colors`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add
            </button>
            {undoEntry && (
              <button
                onClick={() => handleUndo(key)}
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
                <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${accentClasses.plus} text-sm font-medium`}>+$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={addInput}
                  onChange={(e) => handleAddFundsInputChange(key, e.target.value)}
                  onKeyDown={(e) => handleAddFundsKeyDown(e, user.id, field)}
                  autoFocus
                  className={`w-24 pl-8 pr-2 py-1.5 text-sm border rounded-lg bg-white focus:ring-2 ${accentClasses.focus} transition-all outline-none ${
                    addError ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
              </div>
              <button
                onClick={() => handleAddFunds(user.id, field)}
                className={`px-2.5 py-1.5 text-sm font-medium text-white ${accentClasses.solid} rounded-lg transition-colors`}
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAddFundsOpen(prev => ({ ...prev, [key]: false }));
                  setAddFundsInputs(prev => ({ ...prev, [key]: '' }));
                  setAddFundsErrors(prev => ({ ...prev, [key]: '' }));
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {addError && <span className="text-xs text-red-600">{addError}</span>}
            {previewTotal !== null && (
              <span className={`text-xs ${accent === 'amber' ? 'text-amber-600' : 'text-emerald-600'} font-medium`}>
                New Total: {formatCurrency(previewTotal)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderStatusCell = (user: BudgetUser, field: BudgetField) => {
    const key = rk(user.id, field);
    const status = rowStatuses[key] || 'idle';
    return (
      <div className="w-5 h-5 flex items-center justify-center">
        {status === 'saving' && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        {status === 'saved' && <Check className="w-4 h-4 text-emerald-500" />}
        {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
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
              <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Regular Budget
                </span>
              </th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Add</th>
              <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-600" /> Gas Budget
                </span>
              </th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Add</th>
              <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors align-top">
                <td className="py-3 px-5">
                  <span className="font-medium text-slate-800">{user.name}</span>
                </td>
                <td className="py-3 px-5">{renderBudgetCell(user, 'budget')}</td>
                <td className="py-3 px-3">
                  <div className="flex items-start gap-2">
                    {renderAddFundsCell(user, 'budget')}
                    {renderStatusCell(user, 'budget')}
                  </div>
                </td>
                <td className="py-3 px-5">{renderBudgetCell(user, 'gas_budget')}</td>
                <td className="py-3 px-3">
                  <div className="flex items-start gap-2">
                    {renderAddFundsCell(user, 'gas_budget')}
                    {renderStatusCell(user, 'gas_budget')}
                  </div>
                </td>
                <td className="py-3 px-5 text-sm text-slate-500">
                  {formatDate(user.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
