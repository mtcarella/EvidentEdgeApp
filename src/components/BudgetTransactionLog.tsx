import { useState, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Calendar, Filter, X, Loader2, DollarSign, TrendingUp, TrendingDown, Minus, Fuel, FileText, Receipt, ExternalLink, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface BudgetTransaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  description: string;
  budget_type: string;
  balance_after: number | null;
  meeting_id: string | null;
  created_at: string;
}

type SortField = 'created_at' | 'description' | 'amount' | 'category' | 'type';
type SortDir = 'asc' | 'desc';

interface Props {
  onBack?: () => void;
}

export function BudgetTransactionLog({ onBack }: Props) {
  const { salesPerson } = useAuth();
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [selectedTransaction, setSelectedTransaction] = useState<BudgetTransaction | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'credit' | 'debit'>('all');
  const [selectedBudgetType, setSelectedBudgetType] = useState<'all' | 'regular' | 'gas'>('all');

  useEffect(() => {
    if (salesPerson?.id) fetchTransactions();
  }, [salesPerson?.id]);

  const fetchTransactions = async () => {
    if (!salesPerson?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('budget_transactions')
      .select('id, amount, type, category, description, budget_type, balance_after, meeting_id, created_at')
      .eq('sales_person_id', salesPerson.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTransactions(data as BudgetTransaction[]);
    }
    setLoading(false);
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      const d = new Date(t.created_at);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (selectedBudgetType !== 'all') {
      result = result.filter(t => t.budget_type === selectedBudgetType);
    }

    if (selectedType !== 'all') {
      result = result.filter(t => t.type === selectedType);
    }

    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      result = result.filter(t => {
        const d = new Date(t.created_at);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter(t => new Date(t.created_at) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.created_at) <= end);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'description':
          cmp = a.description.localeCompare(b.description);
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
        case 'category':
          cmp = a.category.localeCompare(b.category);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [transactions, selectedBudgetType, selectedType, selectedMonth, startDate, endDate, sortField, sortDir]);

  const summary = useMemo(() => {
    const regular = filteredTransactions.filter(t => t.budget_type === 'regular');
    const gas = filteredTransactions.filter(t => t.budget_type === 'gas');

    const calc = (txns: BudgetTransaction[]) => {
      const totalCredits = txns.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
      const totalDebits = txns.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
      return { totalCredits, totalDebits, net: totalCredits - totalDebits };
    };

    return { regular: calc(regular), gas: calc(gas) };
  }, [filteredTransactions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedMonth('');
    setSelectedType('all');
    setSelectedBudgetType('all');
  };

  const hasActiveFilters = startDate || endDate || selectedMonth || selectedType !== 'all' || selectedBudgetType !== 'all';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Budget Transaction Log
            </h2>
          </div>
        </div>
        <span className="text-sm text-slate-500">
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary Bar */}
      <div className="space-y-4 mb-6">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            Regular Budget
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Credits</span>
              </div>
              <p className="text-lg font-bold text-emerald-800">{formatCurrency(summary.regular.totalCredits)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Debits</span>
              </div>
              <p className="text-lg font-bold text-red-800">{formatCurrency(summary.regular.totalDebits)}</p>
            </div>
            <div className={`border rounded-xl p-3 ${summary.regular.net >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Minus className={`w-3.5 h-3.5 ${summary.regular.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${summary.regular.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Change</span>
              </div>
              <p className={`text-lg font-bold ${summary.regular.net >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                {summary.regular.net >= 0 ? '+' : ''}{formatCurrency(summary.regular.net)}
              </p>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Fuel className="w-3.5 h-3.5 text-amber-600" />
            Gas Budget
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Credits</span>
              </div>
              <p className="text-lg font-bold text-emerald-800">{formatCurrency(summary.gas.totalCredits)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Debits</span>
              </div>
              <p className="text-lg font-bold text-red-800">{formatCurrency(summary.gas.totalDebits)}</p>
            </div>
            <div className={`border rounded-xl p-3 ${summary.gas.net >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Minus className={`w-3.5 h-3.5 ${summary.gas.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${summary.gas.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Change</span>
              </div>
              <p className={`text-lg font-bold ${summary.gas.net >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                {summary.gas.net >= 0 ? '+' : ''}{formatCurrency(summary.gas.net)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Filters</span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" />
              Clear Filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none bg-white"
            >
              <option value="">All Months</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value as 'all' | 'credit' | 'debit')}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none bg-white"
            >
              <option value="all">All Types</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Budget</label>
            <select
              value={selectedBudgetType}
              onChange={e => setSelectedBudgetType(e.target.value as 'all' | 'regular' | 'gas')}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none bg-white"
            >
              <option value="all">All Budgets</option>
              <option value="regular">Regular</option>
              <option value="gas">Gas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSort('created_at')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors">
                    Date <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSort('description')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors">
                    Description <SortIcon field="description" />
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSort('amount')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors">
                    Amount <SortIcon field="amount" />
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSort('category')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors">
                    Account <SortIcon field="category" />
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSort('type')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors">
                    Type <SortIcon field="type" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <DollarSign className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 font-medium">No transactions found</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {hasActiveFilters ? 'Try adjusting your filters' : 'Budget transactions will appear here as they are logged'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTransaction(t)}
                    className={`border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors ${
                      t.meeting_id ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-800 max-w-[240px]">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{t.description || '\u2014'}</span>
                        {t.meeting_id && <ExternalLink className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-sm font-semibold whitespace-nowrap ${t.type === 'credit' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        t.budget_type === 'gas'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {t.budget_type === 'gas' ? 'Gas' : 'Budget'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        t.type === 'credit'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {t.type === 'credit' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t.type === 'credit' ? 'Credit' : 'Debit'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
}

interface MeetingDetail {
  id: string;
  meeting_date: string;
  notes: string | null;
  is_meeting: boolean;
  is_call: boolean;
  is_text: boolean;
  is_email: boolean;
  expense_amount: number | null;
  expense_payment_method: string | null;
  contact: { name: string } | null;
}

interface MeetingExpense {
  id: string;
  amount: number;
  description: string | null;
  receipt_path: string | null;
  receipt_name: string | null;
  notes: string | null;
  category: string | null;
}

interface MeetingReceipt {
  id: string;
  file_path: string;
  file_name: string | null;
  amount: number | null;
}

function TransactionDetailModal({ transaction, onClose }: { transaction: BudgetTransaction; onClose: () => void }) {
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [expenses, setExpenses] = useState<MeetingExpense[]>([]);
  const [receipts, setReceipts] = useState<MeetingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (transaction.meeting_id) {
      fetchMeetingDetails();
    } else {
      setLoading(false);
    }
  }, [transaction.meeting_id]);

  const fetchMeetingDetails = async () => {
    if (!transaction.meeting_id) return;
    setLoading(true);

    const [meetingRes, expensesRes, receiptsRes] = await Promise.all([
      supabase
        .from('meetings')
        .select('id, meeting_date, notes, is_meeting, is_call, is_text, is_email, expense_amount, expense_payment_method, contact:contacts(name)')
        .eq('id', transaction.meeting_id)
        .maybeSingle(),
      supabase
        .from('meeting_expenses')
        .select('id, amount, description, receipt_path, receipt_name, notes, category')
        .eq('meeting_id', transaction.meeting_id)
        .order('created_at', { ascending: true }),
      supabase
        .from('meeting_receipts')
        .select('id, file_path, file_name, amount')
        .eq('meeting_id', transaction.meeting_id)
        .order('created_at', { ascending: true }),
    ]);

    if (meetingRes.data) setMeeting(meetingRes.data as any);
    if (expensesRes.data) setExpenses(expensesRes.data as MeetingExpense[]);
    if (receiptsRes.data) setReceipts(receiptsRes.data as MeetingReceipt[]);
    setLoading(false);
  };

  const openReceipt = async (path: string) => {
    if (receiptUrls[path]) {
      window.open(receiptUrls[path], '_blank');
      return;
    }
    const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 300);
    if (data?.signedUrl) {
      setReceiptUrls(prev => ({ ...prev, [path]: data.signedUrl }));
      window.open(data.signedUrl, '_blank');
    }
  };

  const getMeetingTypeLabel = () => {
    if (!meeting) return '';
    const types = [];
    if (meeting.is_meeting) types.push('Meeting');
    if (meeting.is_call) types.push('Call');
    if (meeting.is_text) types.push('Text');
    if (meeting.is_email) types.push('Email');
    return types.join(', ') || 'Meeting';
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900">Transaction Details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-64px)] p-6 space-y-5">
          {/* Transaction summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase">Amount</span>
              <span className={`text-lg font-bold ${transaction.type === 'credit' ? 'text-emerald-700' : 'text-red-700'}`}>
                {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase">Date</span>
              <span className="text-sm text-slate-700">
                {new Date(transaction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase">Account</span>
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                transaction.budget_type === 'gas' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {transaction.budget_type === 'gas' ? 'Gas' : 'Budget'}
              </span>
            </div>
            {transaction.balance_after !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 uppercase">Balance After</span>
                <span className="text-sm text-slate-700">{formatCurrency(transaction.balance_after)}</span>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}

          {!loading && !transaction.meeting_id && (
            <div className="text-center py-6">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">No linked meeting for this transaction</p>
            </div>
          )}

          {!loading && meeting && (
            <>
              {/* Meeting info */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Linked Meeting
                </h4>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Contact</span>
                    <span className="text-sm font-medium text-slate-800">{(meeting.contact as any)?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Date</span>
                    <span className="text-sm text-slate-700">
                      {new Date(meeting.meeting_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Type</span>
                    <span className="text-sm text-slate-700">{getMeetingTypeLabel()}</span>
                  </div>
                  {meeting.expense_payment_method && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Payment</span>
                      <span className="text-sm text-slate-700 capitalize">{meeting.expense_payment_method}</span>
                    </div>
                  )}
                  {meeting.expense_amount != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Total Expense</span>
                      <span className="text-sm font-medium text-slate-800">{formatCurrency(meeting.expense_amount)}</span>
                    </div>
                  )}
                  {meeting.notes && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500 block mb-1">Notes</span>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{meeting.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expense line items */}
              {expenses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    Expense Items ({expenses.length})
                  </h4>
                  <div className="space-y-2">
                    {expenses.map(exp => (
                      <div key={exp.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{exp.description || 'Expense'}</p>
                          {exp.category && <p className="text-xs text-slate-400">{exp.category}</p>}
                          {exp.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{exp.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-semibold text-slate-800">{formatCurrency(exp.amount)}</span>
                          {exp.receipt_path && (
                            <button
                              onClick={() => openReceipt(exp.receipt_path!)}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                              title="View receipt"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy receipts (meeting_receipts table) */}
              {receipts.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    Receipts ({receipts.length})
                  </h4>
                  <div className="space-y-2">
                    {receipts.map(r => (
                      <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{r.file_name || 'Receipt'}</p>
                          {r.amount != null && <p className="text-xs text-slate-500">{formatCurrency(r.amount)}</p>}
                        </div>
                        <button
                          onClick={() => openReceipt(r.file_path)}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                          title="View receipt"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expenses.length === 0 && receipts.length === 0 && (
                <div className="text-center py-4">
                  <Receipt className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                  <p className="text-xs text-slate-400">No expense items or receipts recorded</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
