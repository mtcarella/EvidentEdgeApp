import { useState, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Calendar, Filter, X, Loader2, DollarSign, TrendingUp, TrendingDown, Minus, Eye, Image, FileText, Fuel } from 'lucide-react';
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
  created_at: string;
  meeting_id: string | null;
}

interface MeetingDetail {
  id: string;
  meeting_date: string;
  notes: string | null;
  has_expense: boolean;
  expense_payment_method: string | null;
  expense_amount: number | null;
  is_meeting: boolean;
  is_text: boolean;
  is_call: boolean;
  is_email: boolean;
  contact: { name: string } | null;
  salesperson: { name: string } | null;
  receipts: { id: string; file_path: string; file_name: string }[];
  expenses: {
    id: string;
    description: string;
    amount: number;
    category: string;
    receipt_path: string | null;
    receipt_original_name: string | null;
  }[];
}

type SortField = 'created_at' | 'description' | 'amount' | 'budget_type' | 'type';
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

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedBudgetType, setSelectedBudgetType] = useState<'all' | 'regular' | 'gas'>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'credit' | 'debit'>('all');

  // Meeting detail popup
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingDetail | null>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');

  useEffect(() => {
    if (salesPerson?.id) fetchTransactions();
  }, [salesPerson?.id]);

  const fetchTransactions = async () => {
    if (!salesPerson?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('budget_transactions')
      .select('id, amount, type, category, description, budget_type, balance_after, created_at, meeting_id')
      .eq('sales_person_id', salesPerson.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTransactions(data as BudgetTransaction[]);
    }
    setLoading(false);
  };

  const handleTransactionClick = async (transaction: BudgetTransaction) => {
    if (!transaction.meeting_id) return;
    setLoadingMeeting(true);

    const { data, error } = await supabase
      .from('meetings')
      .select(`
        id, meeting_date, notes, has_expense, expense_payment_method, expense_amount,
        is_meeting, is_text, is_call, is_email,
        contact:contacts(name),
        salesperson:sales_people!meetings_salesperson_id_fkey(name),
        receipts:meeting_receipts(id, file_path, file_name),
        expenses:meeting_expenses(id, description, amount, category, receipt_path, receipt_original_name)
      `)
      .eq('id', transaction.meeting_id)
      .single();

    if (!error && data) {
      setSelectedMeeting({
        ...data,
        contact: data.contact as unknown as { name: string } | null,
        salesperson: data.salesperson as unknown as { name: string } | null,
        receipts: (data.receipts || []) as MeetingDetail['receipts'],
        expenses: (data.expenses || []) as MeetingDetail['expenses'],
      });
    }
    setLoadingMeeting(false);
  };

  const handleViewReceipt = async (filePath: string, fileName?: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(filePath, 300);
      if (error || !data?.signedUrl) return;
      setPreviewUrl(data.signedUrl);
      setPreviewFilename(fileName || filePath.split('/').pop() || 'receipt');
    } catch (err) {
      console.error('Error loading receipt:', err);
    }
  };

  const closeMeetingModal = () => {
    setSelectedMeeting(null);
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewFilename('');
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

    if (selectedType !== 'all') {
      result = result.filter(t => t.type === selectedType);
    }

    if (selectedBudgetType !== 'all') {
      result = result.filter(t => t.budget_type === selectedBudgetType);
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
        case 'budget_type':
          cmp = a.budget_type.localeCompare(b.budget_type);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [transactions, selectedType, selectedBudgetType, selectedMonth, startDate, endDate, sortField, sortDir]);

  const regularSummary = useMemo(() => {
    const regular = filteredTransactions.filter(t => t.budget_type === 'regular');
    const totalCredits = regular.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = regular.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
    return { totalCredits, totalDebits, net: totalCredits - totalDebits };
  }, [filteredTransactions]);

  const gasSummary = useMemo(() => {
    const gas = filteredTransactions.filter(t => t.budget_type === 'gas');
    const totalCredits = gas.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = gas.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
    return { totalCredits, totalDebits, net: totalCredits - totalDebits };
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
    setSelectedBudgetType('all');
    setSelectedType('all');
  };

  const hasActiveFilters = startDate || endDate || selectedMonth || selectedBudgetType !== 'all' || selectedType !== 'all';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getMeetingTypes = (meeting: MeetingDetail) => {
    const types: string[] = [];
    if (meeting.is_meeting) types.push('Meeting');
    if (meeting.is_call) types.push('Call');
    if (meeting.is_text) types.push('Text');
    if (meeting.is_email) types.push('Email');
    return types.join(', ') || 'Meeting';
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
            <h2 className="text-lg font-semibold text-slate-900">Budget Transaction Log</h2>
          </div>
        </div>
        <span className="text-sm text-slate-500">
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary Bars - Regular Budget */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-700">Regular Budget</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Credits</span>
            </div>
            <p className="text-lg font-bold text-emerald-800">{formatCurrency(regularSummary.totalCredits)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingDown className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Debits</span>
            </div>
            <p className="text-lg font-bold text-red-800">{formatCurrency(regularSummary.totalDebits)}</p>
          </div>
          <div className={`border rounded-xl p-3 ${regularSummary.net >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <Minus className={`w-3.5 h-3.5 ${regularSummary.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${regularSummary.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Change</span>
            </div>
            <p className={`text-lg font-bold ${regularSummary.net >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
              {regularSummary.net >= 0 ? '+' : ''}{formatCurrency(regularSummary.net)}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Bars - Gas Budget */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Fuel className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-slate-700">Gas Budget</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Credits</span>
            </div>
            <p className="text-lg font-bold text-emerald-800">{formatCurrency(gasSummary.totalCredits)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingDown className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Debits</span>
            </div>
            <p className="text-lg font-bold text-red-800">{formatCurrency(gasSummary.totalDebits)}</p>
          </div>
          <div className={`border rounded-xl p-3 ${gasSummary.net >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <Minus className={`w-3.5 h-3.5 ${gasSummary.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${gasSummary.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Change</span>
            </div>
            <p className={`text-lg font-bold ${gasSummary.net >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
              {gasSummary.net >= 0 ? '+' : ''}{formatCurrency(gasSummary.net)}
            </p>
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
            <label className="block text-xs font-medium text-slate-500 mb-1">Account</label>
            <select
              value={selectedBudgetType}
              onChange={e => setSelectedBudgetType(e.target.value as 'all' | 'regular' | 'gas')}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none bg-white"
            >
              <option value="all">All Accounts</option>
              <option value="regular">Budget</option>
              <option value="gas">Gas</option>
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
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
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
                  <button onClick={() => handleSort('budget_type')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors">
                    Account <SortIcon field="budget_type" />
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button onClick={() => handleSort('type')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors">
                    Type <SortIcon field="type" />
                  </button>
                </th>
                <th className="text-center py-3 px-3 w-12">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
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
                    className={`border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors ${t.meeting_id ? 'cursor-pointer' : ''}`}
                    onClick={() => t.meeting_id && handleTransactionClick(t)}
                  >
                    <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-800 max-w-[240px] truncate">
                      {t.description || '\u2014'}
                    </td>
                    <td className={`py-3 px-4 text-sm font-semibold whitespace-nowrap ${t.type === 'credit' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        t.budget_type === 'gas'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {t.budget_type === 'gas' ? <Fuel className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
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
                    <td className="py-3 px-3 text-center">
                      {t.meeting_id ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTransactionClick(t); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="View linked meeting"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-300">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Meeting Detail Modal */}
      {(selectedMeeting || loadingMeeting) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeMeetingModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {loadingMeeting && !selectedMeeting ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : selectedMeeting && (
              <>
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                  <h3 className="text-lg font-semibold text-slate-900">Meeting Details</h3>
                  <button
                    onClick={closeMeetingModal}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Date</span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        {formatDate(selectedMeeting.meeting_date)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Type</span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        {getMeetingTypes(selectedMeeting)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Contact</span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        {selectedMeeting.contact?.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Salesperson</span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        {selectedMeeting.salesperson?.name || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {selectedMeeting.notes && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notes</span>
                      <p className="text-sm text-slate-700 mt-1 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">
                        {selectedMeeting.notes}
                      </p>
                    </div>
                  )}

                  {selectedMeeting.has_expense && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Expense</span>
                      <div className="flex items-center gap-4 mt-1.5">
                        {selectedMeeting.expense_amount != null && (
                          <span className="text-sm font-bold text-amber-900">
                            {formatCurrency(selectedMeeting.expense_amount)}
                          </span>
                        )}
                        {selectedMeeting.expense_payment_method && (
                          <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full capitalize">
                            {selectedMeeting.expense_payment_method === 'personal' ? 'Personal Card' : 'Company Card'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedMeeting.expenses.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Expense Items</span>
                      <div className="mt-2 space-y-2">
                        {selectedMeeting.expenses.map(exp => (
                          <div key={exp.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{exp.description || 'Expense'}</p>
                              <p className="text-xs text-slate-500 capitalize">{exp.category}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-700">{formatCurrency(exp.amount)}</span>
                              {exp.receipt_path && (
                                <button
                                  onClick={() => handleViewReceipt(exp.receipt_path!, exp.receipt_original_name || undefined)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                  title="View receipt"
                                >
                                  <Image className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedMeeting.receipts.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Receipts</span>
                      <div className="mt-2 space-y-2">
                        {selectedMeeting.receipts.map(receipt => (
                          <button
                            key={receipt.id}
                            onClick={() => handleViewReceipt(receipt.file_path, receipt.file_name)}
                            className="w-full flex items-center gap-3 p-2.5 bg-slate-50 hover:bg-emerald-50 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors text-left"
                          >
                            <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                            <span className="text-sm text-slate-700 truncate flex-1">
                              {receipt.file_name || receipt.file_path.split('/').pop() || 'Receipt'}
                            </span>
                            <Eye className="w-4 h-4 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedMeeting.receipts.length === 0 && selectedMeeting.expenses.every(e => !e.receipt_path) && (
                    <p className="text-sm text-slate-400 italic text-center py-2">No receipts attached to this meeting</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={closePreview}>
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-white rounded-t-xl px-4 py-3 border-b border-slate-200">
              <span className="text-sm font-medium text-slate-700 truncate">{previewFilename}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download={previewFilename}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={closePreview}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-b-xl overflow-auto flex items-center justify-center p-4">
              {previewUrl.match(/\.pdf/i) ? (
                <iframe src={previewUrl} className="w-full h-[70vh] border-0 rounded" />
              ) : (
                <img src={previewUrl} alt={previewFilename} className="max-w-full max-h-[70vh] object-contain rounded" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
