import { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuditEntry {
  id: string;
  table_name: string;
  action: string;
  changed_at: string;
  changed_by: string | null;
  old_data: any;
  new_data: any;
  userName?: string;
}

type DateRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'custom' | 'all';

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadAuditLog();
  }, [limit, dateRange, customStartDate, customEndDate]);

  const getDateRangeFilter = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'today':
        return { start: today.toISOString() };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayEnd = new Date(today);
        return { start: yesterday.toISOString(), end: yesterdayEnd.toISOString() };
      case 'last7':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        return { start: last7.toISOString() };
      case 'last30':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        return { start: last30.toISOString() };
      case 'last90':
        const last90 = new Date(today);
        last90.setDate(last90.getDate() - 90);
        return { start: last90.toISOString() };
      case 'custom':
        if (customStartDate && customEndDate) {
          const startDate = new Date(customStartDate);
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          return { start: startDate.toISOString(), end: endDate.toISOString() };
        } else if (customStartDate) {
          return { start: new Date(customStartDate).toISOString() };
        } else if (customEndDate) {
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          return { end: endDate.toISOString() };
        }
        return null;
      default:
        return null;
    }
  };

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit);

      const dateFilter = getDateRangeFilter();
      if (dateFilter) {
        if (dateFilter.start) {
          query = query.gte('changed_at', dateFilter.start);
        }
        if (dateFilter.end) {
          query = query.lte('changed_at', dateFilter.end);
        }
      }

      const { data: logs } = await query;

      if (logs) {
        const userIds = [...new Set(logs.map(l => l.changed_by).filter(Boolean))];
        const { data: users } = await supabase
          .from('sales_people')
          .select('user_id, name')
          .in('user_id', userIds);

        const userMap = new Map(users?.map(u => [u.user_id, u.name]) || []);

        const enrichedLogs = logs.map(log => ({
          ...log,
          userName: log.changed_by ? userMap.get(log.changed_by) || 'Unknown' : 'System',
        }));

        setEntries(enrichedLogs);
      }
    } catch (error) {
      console.error('Error loading audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getTableLabel = (tableName: string) => {
    const labels: Record<string, string> = {
      contacts: 'Contact',
      assignments: 'Assignment',
      sales_people: 'Salesperson',
    };
    return labels[tableName] || tableName;
  };

  const renderDataDiff = (entry: AuditEntry) => {
    if (entry.action === 'INSERT' && entry.new_data) {
      return (
        <div className="bg-green-50 p-3 rounded border border-green-200">
          <p className="text-xs font-semibold text-green-900 mb-2">New Record</p>
          <pre className="text-xs text-green-800 whitespace-pre-wrap">
            {JSON.stringify(entry.new_data, null, 2)}
          </pre>
        </div>
      );
    }

    if (entry.action === 'DELETE' && entry.old_data) {
      return (
        <div className="bg-red-50 p-3 rounded border border-red-200">
          <p className="text-xs font-semibold text-red-900 mb-2">Deleted Record</p>
          <pre className="text-xs text-red-800 whitespace-pre-wrap">
            {JSON.stringify(entry.old_data, null, 2)}
          </pre>
        </div>
      );
    }

    if (entry.action === 'UPDATE' && entry.old_data && entry.new_data) {
      const changes: string[] = [];
      Object.keys(entry.new_data).forEach(key => {
        if (JSON.stringify(entry.old_data[key]) !== JSON.stringify(entry.new_data[key])) {
          changes.push(`${key}: ${entry.old_data[key]} → ${entry.new_data[key]}`);
        }
      });

      return (
        <div className="bg-blue-50 p-3 rounded border border-blue-200">
          <p className="text-xs font-semibold text-blue-900 mb-2">Changes Made</p>
          <ul className="text-xs text-blue-800 space-y-1">
            {changes.map((change, idx) => (
              <li key={idx}>{change}</li>
            ))}
          </ul>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-slate-700" />
          <h2 className="text-2xl font-bold text-slate-900">Audit Log</h2>
        </div>
        <button
          onClick={() => {
            setDateRange('today');
            setCustomStartDate('');
            setCustomEndDate('');
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Today's Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Date Range</label>
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value as DateRange);
              if (e.target.value !== 'custom') {
                setCustomStartDate('');
                setCustomEndDate('');
              }
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="last90">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {dateRange === 'custom' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Results Limit</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={20}>Last 20</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={500}>Last 500</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading audit log...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No audit entries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${getActionColor(entry.action)}`}>
                    {entry.action}
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    {getTableLabel(entry.table_name)}
                  </span>
                  <span className="text-xs text-slate-500">by {entry.userName}</span>
                  <span className="text-xs text-slate-400">{formatDate(entry.changed_at)}</span>
                </div>
                {expanded === entry.id ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {expanded === entry.id && (
                <div className="p-4 border-t border-slate-200">
                  {renderDataDiff(entry)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
