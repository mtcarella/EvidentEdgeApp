import { useState, useEffect, useRef, useCallback } from 'react';
import { DollarSign, Check, Loader2, AlertCircle, RefreshCw, PlusCircle, MinusCircle, Undo2, X, Fuel, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BudgetType } from '../lib/budgetUtils';
import { BudgetTransactionLog } from './BudgetTransactionLog';

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
type AdjustMode = 'add' | 'subtract';

interface UndoEntry {
  userId: string;
  field: BudgetField;
  previousValue: number;
  delta: number;
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
  const [adjustMode, setAdjustMode] = useState<Record<RowKey, AdjustMode | undefined>>({});
  const [reasonInputs, setReasonInputs] = useState<Record<RowKey, string>>({});
  const [undoEntries, setUndoEntries] = useState<Record<RowKey, UndoEntry>>({});
  const [focusedKey, setFocusedKey] = useState<RowKey | null>(null);
  const [viewingUser, setViewingUser] = useState<BudgetUser | null>(null);
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

  const closeAdjust = (key: RowKey) => {
    setAdjustMode(prev => ({ ...prev, [key]: undefined }));
    setAddFundsInputs(prev => ({ ...prev, [key]: '' }));
    setReasonInputs(prev => ({ ...prev, [key]: '' }));
    setAddFundsErrors(prev => ({ ...prev, [key]: '' }));
  };

  const handleAdjust = useCallback(async (userId: string, field: BudgetField) => {
    const key = rk(userId, field);
    const mode = adjustMode[key];
    if (!mode) return;
    const inputValue = addFundsInputs[key] || '';
    const validationError = validateAddFunds(inputValue);
    if (validationError) {
      setAddFundsErrors(prev => ({ ...prev, [key]: validationError }));
      return;
    }

    const amount = parseFloat(inputValue);
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const delta = mode === 'add' ? amount : -amount;
    const reason = (reasonInputs[key] || '').trim();
    const previousValue = parseFloat(String(user[field])) || 0;
    const newValue = Math.round((previousValue + delta) * 100) / 100;

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: newValue } : u));
    const success = await saveBudget(userId, field, newValue);

    if (success) {
      closeAdjust(key);

      const adminName = salesPerson?.name || 'Admin';
      const fieldLabel = field === 'gas_budget' ? 'gas budget' : 'budget';
      const action = mode === 'add' ? `added funds to ${fieldLabel}` : `subtracted funds from ${fieldLabel}`;
      logTransaction(
        user,
        field,
        amount,
        mode === 'add' ? 'credit' : 'debit',
        newValue,
        `${adminName} ${action}${reason ? ` — ${reason}` : ''}`
      );

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
        [key]: { userId, field, previousValue, delta, timer },
      }));
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: previousValue } : u));
    }
  }, [adjustMode, addFundsInputs, reasonInputs, users, saveBudget, undoEntries, logTransaction, salesPerson]);

  const handleUndo = useCallback(async (key: RowKey) => {
    const entry = undoEntries[key];
    if (!entry) return;
    clearTimeout(entry.timer);

    const targetUser = users.find(u => u.id === entry.userId);
    setUsers(prev => prev.map(u => u.id === entry.userId ? { ...u, [entry.field]: entry.previousValue } : u));
    await saveBudget(entry.userId, entry.field, entry.previousValue);

    if (targetUser) {
      const fieldLabel = entry.field === 'gas_budget' ? 'gas budget' : 'budget';
      const wasAdd = entry.delta > 0;
      logTransaction(
        targetUser,
        entry.field,
        Math.abs(entry.delta),
        wasAdd ? 'debit' : 'credit',
        entry.previousValue,
        wasAdd ? `Undo: funds removed from ${fieldLabel}` : `Undo: funds returned to ${fieldLabel}`
      );
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

  const handleAdjustKeyDown = (e: React.KeyboardEvent, userId: string, field: BudgetField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdjust(userId, field);
    } else if (e.key === 'Escape') {
      closeAdjust(rk(userId, field));
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
    const delta = adjustMode[key] === 'subtract' ? -amount : amount;
    return Math.round((currentValue + delta) * 100) / 100;
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

  if (viewingUser) {
    return (
      <BudgetTransactionLog
        targetUserId={viewingUser.id}
        targetUserName={viewingUser.name}
        adminMode
        onBack={() => setViewingUser(null)}
      />
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
    const mode = adjustMode[key];
    const amountInput = addFundsInputs[key] || '';
    const reasonInput = reasonInputs[key] || '';
    const amountError = addFundsErrors[key] || '';
    const previewTotal = getPreviewTotal(user.id, field);
    const undoEntry = undoEntries[key];
    const addClasses = field === 'gas_budget'
      ? { soft: 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200', solid: 'bg-amber-600 hover:bg-amber-700', focus: 'focus:ring-amber-500/30 focus:border-amber-400', text: 'text-amber-600' }
      : { soft: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200', solid: 'bg-emerald-600 hover:bg-emerald-700', focus: 'focus:ring-emerald-500/30 focus:border-emerald-400', text: 'text-emerald-600' };
    const subtractClasses = { soft: 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200', solid: 'bg-red-600 hover:bg-red-700', focus: 'focus:ring-red-500/30 focus:border-red-400', text: 'text-red-600' };
    const active = mode === 'subtract' ? subtractClasses : addClasses;

    if (!mode) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAdjustMode(prev => ({ ...prev, [key]: 'add' }))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors ${addClasses.soft}`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add
          </button>
          <button
            onClick={() => setAdjustMode(prev => ({ ...prev, [key]: 'subtract' }))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors ${subtractClasses.soft}`}
          >
            <MinusCircle className="w-3.5 h-3.5" />
            Subtract
          </button>
          {undoEntry && (
            <button
              onClick={() => handleUndo(key)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors animate-pulse"
              title="Reverse the last change"
            >
              <Undo2 className="w-3 h-3" />
              Undo {undoEntry.delta > 0 ? '+' : '-'}{formatCurrency(Math.abs(undoEntry.delta))}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5 w-60">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${active.text} text-sm font-medium`}>
              {mode === 'add' ? '+$' : '-$'}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => handleAddFundsInputChange(key, e.target.value)}
              onKeyDown={(e) => handleAdjustKeyDown(e, user.id, field)}
              autoFocus
              className={`w-24 pl-8 pr-2 py-1.5 text-sm border rounded-lg bg-white focus:ring-2 ${active.focus} transition-all outline-none ${
                amountError ? 'border-red-300' : 'border-slate-200'
              }`}
            />
          </div>
          <button
            onClick={() => handleAdjust(user.id, field)}
            className={`px-2.5 py-1.5 text-sm font-medium text-white ${active.solid} rounded-lg transition-colors`}
          >
            {mode === 'add' ? 'Add' : 'Subtract'}
          </button>
          <button
            onClick={() => closeAdjust(key)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <input
          type="text"
          maxLength={200}
          placeholder="Reason (optional)"
          value={reasonInput}
          onChange={(e) => setReasonInputs(prev => ({ ...prev, [key]: e.target.value }))}
          onKeyDown={(e) => handleAdjustKeyDown(e, user.id, field)}
          className={`w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 ${active.focus} transition-all outline-none`}
        />
        {amountError && <span className="text-xs text-red-600">{amountError}</span>}
        {previewTotal !== null && (
          <span className={`text-xs font-medium ${previewTotal < 0 ? 'text-red-600' : active.text}`}>
            New Total: {formatCurrency(previewTotal)}
          </span>
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
              <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Adjust</th>
              <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-600" /> Gas Budget
                </span>
              </th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Adjust</th>
              <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Updated</th>
              <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">Log</th>
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
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => setViewingUser(user)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title={`View ${user.name}'s transaction log`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
