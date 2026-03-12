import { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronUp, Plus, Pencil, Trash2, User, Building2, Phone, Mail, MapPin, FileText, Calendar as CalendarIcon, DollarSign, Users, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getESTToday, formatTimestampForDisplay } from '../lib/dateUtils';

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

const fieldLabels: Record<string, Record<string, string>> = {
  contacts: {
    id: 'Contact ID',
    first_name: 'First Name',
    last_name: 'Last Name',
    company: 'Company',
    title: 'Job Title',
    email: 'Email Address',
    phone: 'Phone Number',
    cell_phone: 'Cell Phone',
    address: 'Address',
    notes: 'Notes',
    processor_notes: 'Processor Notes',
    branch: 'Branch',
    status: 'Status',
    contact_type: 'Contact Type',
    vendor_type: 'Vendor Type',
    paralegal: 'Paralegal',
    evident_paralegal: 'Evident Paralegal',
    paralegal_processor: 'Paralegal/Processor',
    drinks: 'Drinks Alcohol',
    created_at: 'Created Date',
    updated_at: 'Last Updated',
    assigned_to: 'Assigned To',
    marketing_points: 'Marketing Points',
    client_identifier_no: 'Client Identifier Number',
  },
  sales_people: {
    id: 'User ID',
    user_id: 'Auth User ID',
    name: 'Full Name',
    first_name: 'First Name',
    last_name: 'Last Name',
    email: 'Email Address',
    phone: 'Phone Number',
    cell_phone: 'Cell Phone',
    role: 'Role',
    branch: 'Branch',
    is_active: 'Active Status',
    birthday: 'Birthday',
    created_at: 'Created Date',
    updated_at: 'Last Updated',
  },
  assignments: {
    id: 'Assignment ID',
    contact_id: 'Contact',
    salesperson_id: 'Assigned Salesperson',
    assigned_at: 'Assignment Date',
    created_at: 'Created Date',
  },
  meetings: {
    id: 'Meeting ID',
    contact_id: 'Contact',
    salesperson_id: 'Salesperson',
    meeting_date: 'Meeting Date',
    meeting_type: 'Meeting Type',
    location: 'Location',
    notes: 'Notes',
    expense_type: 'Expense Type',
    expense_amount: 'Expense Amount',
    expense_payment_method: 'Payment Method',
    created_at: 'Created Date',
  },
  verified_wires: {
    id: 'Wire ID',
    loan_number: 'Loan Number',
    client_name: 'Client Name',
    phone: 'Phone',
    wire_amount: 'Wire Amount',
    verified_by: 'Verified By',
    verification_date: 'Verification Date',
    notes: 'Notes',
  },
};

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  super_admin: 'Super Administrator',
  salesperson: 'Salesperson',
  processor: 'Processor',
  sales_processor: 'Sales Processor',
  closer: 'Closer',
  user: 'User',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  lead: 'Lead',
  prospect: 'Prospect',
  client: 'Client',
};

const contactTypeLabels: Record<string, string> = {
  attorney: 'Attorney',
  realtor: 'Realtor',
  lender: 'Lender',
  vendor: 'Vendor',
  other: 'Other',
};

const vendorTypeLabels: Record<string, string> = {
  title_company: 'Title Company',
  insurance: 'Insurance',
  surveyor: 'Surveyor',
  appraiser: 'Appraiser',
  inspector: 'Home Inspector',
  other: 'Other Vendor',
};

const branchLabels: Record<string, string> = {
  new_york: 'New York',
  new_jersey: 'New Jersey',
  florida: 'Florida',
  pennsylvania: 'Pennsylvania',
  all: 'All Branches',
};

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
    const today = getESTToday();

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
    return formatTimestampForDisplay(dateString);
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
      sales_people: 'User',
      meetings: 'Meeting',
      verified_wires: 'Wire Verification',
    };
    return labels[tableName] || tableName;
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'INSERT': return 'Created';
      case 'UPDATE': return 'Updated';
      case 'DELETE': return 'Deleted';
      default: return action;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT': return <Plus className="w-3.5 h-3.5" />;
      case 'UPDATE': return <Pencil className="w-3.5 h-3.5" />;
      case 'DELETE': return <Trash2 className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const getFieldLabel = (tableName: string, fieldName: string): string => {
    return fieldLabels[tableName]?.[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatValue = (tableName: string, fieldName: string, value: any): string => {
    if (value === null || value === undefined) return 'Not set';
    if (value === '') return 'Empty';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (fieldName === 'role' && roleLabels[value]) return roleLabels[value];
    if (fieldName === 'status' && statusLabels[value]) return statusLabels[value];
    if (fieldName === 'contact_type' && contactTypeLabels[value]) return contactTypeLabels[value];
    if (fieldName === 'vendor_type' && vendorTypeLabels[value]) return vendorTypeLabels[value];
    if (fieldName === 'branch' && branchLabels[value]) return branchLabels[value];
    if (fieldName === 'is_active') return value ? 'Active' : 'Inactive';
    if (fieldName === 'drinks') return value ? 'Yes' : 'No';

    if (fieldName.includes('_at') || fieldName.includes('date') || fieldName === 'birthday') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            ...(fieldName.includes('_at') ? { hour: 'numeric', minute: '2-digit' } : {})
          });
        }
      } catch {
        return String(value);
      }
    }

    if (fieldName.includes('amount') || fieldName.includes('wire_amount')) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
      }
    }

    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getRecordIdentifier = (tableName: string, data: any): string => {
    if (!data) return '';

    switch (tableName) {
      case 'contacts':
        const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
        return name || data.company || 'Unknown Contact';
      case 'sales_people':
        return data.name || [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email || 'Unknown User';
      case 'assignments':
        return 'Contact Assignment';
      case 'meetings':
        return data.meeting_type ? `${data.meeting_type} Meeting` : 'Meeting';
      case 'verified_wires':
        return data.client_name || `Loan #${data.loan_number}` || 'Wire';
      default:
        return '';
    }
  };

  const getSummaryDescription = (entry: AuditEntry): string => {
    const identifier = getRecordIdentifier(entry.table_name, entry.new_data || entry.old_data);
    const tableLabel = getTableLabel(entry.table_name).toLowerCase();

    switch (entry.action) {
      case 'INSERT':
        return `Created new ${tableLabel}${identifier ? `: ${identifier}` : ''}`;
      case 'DELETE':
        return `Deleted ${tableLabel}${identifier ? `: ${identifier}` : ''}`;
      case 'UPDATE':
        if (entry.old_data && entry.new_data) {
          const changedFields: string[] = [];
          Object.keys(entry.new_data).forEach(key => {
            if (JSON.stringify(entry.old_data[key]) !== JSON.stringify(entry.new_data[key])) {
              if (!['id', 'created_at', 'updated_at', 'user_id'].includes(key)) {
                changedFields.push(getFieldLabel(entry.table_name, key));
              }
            }
          });
          if (changedFields.length === 0) return `Updated ${tableLabel}${identifier ? `: ${identifier}` : ''}`;
          if (changedFields.length <= 2) {
            return `Changed ${changedFields.join(' and ')} for ${identifier || tableLabel}`;
          }
          return `Made ${changedFields.length} changes to ${identifier || tableLabel}`;
        }
        return `Updated ${tableLabel}${identifier ? `: ${identifier}` : ''}`;
      default:
        return `${entry.action} on ${tableLabel}`;
    }
  };

  const renderDataDiff = (entry: AuditEntry) => {
    const excludedFields = ['id', 'created_at', 'updated_at'];

    if (entry.action === 'INSERT' && entry.new_data) {
      const relevantFields = Object.entries(entry.new_data).filter(
        ([key, value]) => !excludedFields.includes(key) && value !== null && value !== ''
      );

      return (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-green-700" />
            <p className="text-sm font-semibold text-green-800">New Record Created</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {relevantFields.map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-xs font-medium text-green-700">{getFieldLabel(entry.table_name, key)}</span>
                <span className="text-sm text-green-900">{formatValue(entry.table_name, key, value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (entry.action === 'DELETE' && entry.old_data) {
      const identifier = getRecordIdentifier(entry.table_name, entry.old_data);
      const relevantFields = Object.entries(entry.old_data).filter(
        ([key, value]) => !excludedFields.includes(key) && value !== null && value !== ''
      );

      return (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 className="w-4 h-4 text-red-700" />
            <p className="text-sm font-semibold text-red-800">
              Record Deleted{identifier ? `: ${identifier}` : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {relevantFields.map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-xs font-medium text-red-700">{getFieldLabel(entry.table_name, key)}</span>
                <span className="text-sm text-red-900 line-through opacity-75">{formatValue(entry.table_name, key, value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (entry.action === 'UPDATE' && entry.old_data && entry.new_data) {
      const changes: Array<{ field: string; label: string; oldValue: any; newValue: any }> = [];
      Object.keys(entry.new_data).forEach(key => {
        if (!excludedFields.includes(key) && JSON.stringify(entry.old_data[key]) !== JSON.stringify(entry.new_data[key])) {
          changes.push({
            field: key,
            label: getFieldLabel(entry.table_name, key),
            oldValue: entry.old_data[key],
            newValue: entry.new_data[key],
          });
        }
      });

      if (changes.length === 0) {
        return (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-600">No visible changes detected</p>
          </div>
        );
      }

      return (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Pencil className="w-4 h-4 text-blue-700" />
            <p className="text-sm font-semibold text-blue-800">
              {changes.length} {changes.length === 1 ? 'Change' : 'Changes'} Made
            </p>
          </div>
          <div className="space-y-3">
            {changes.map(({ field, label, oldValue, newValue }) => (
              <div key={field} className="bg-white/50 rounded-lg p-3 border border-blue-100">
                <div className="text-xs font-semibold text-blue-700 mb-2">{label}</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-600 bg-red-50 px-2 py-1 rounded line-through">
                    {formatValue(entry.table_name, field, oldValue)}
                  </span>
                  <span className="text-blue-500">to</span>
                  <span className="text-green-700 bg-green-50 px-2 py-1 rounded font-medium">
                    {formatValue(entry.table_name, field, newValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
          <h2 className="text-2xl font-bold text-slate-900 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Audit Log</h2>
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
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-left flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${getActionColor(entry.action)}`}>
                      {getActionIcon(entry.action)}
                      {getActionLabel(entry.action)}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {getTableLabel(entry.table_name)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 flex-1">
                    {getSummaryDescription(entry)}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {entry.userName}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {formatDate(entry.changed_at)}
                    </span>
                  </div>
                </div>
                {expanded === entry.id ? (
                  <ChevronUp className="w-5 h-5 text-slate-400 ml-2" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 ml-2" />
                )}
              </button>

              {expanded === entry.id && (
                <div className="p-4 border-t border-slate-200 bg-white">
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
