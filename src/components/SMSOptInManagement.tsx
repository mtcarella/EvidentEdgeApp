import { useState, useEffect } from 'react';
import { MessageSquare, Search, Download, CheckCircle, XCircle, Calendar, Phone, User, Globe, Monitor } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SMSOptIn {
  id: string;
  user_id: string;
  phone_number: string;
  opted_in: boolean;
  consent_timestamp: string;
  opt_out_timestamp: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

export function SMSOptInManagement() {
  const { salesPerson } = useAuth();
  const [optIns, setOptIns] = useState<SMSOptIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'opted_in' | 'opted_out'>('all');

  useEffect(() => {
    fetchOptIns();
  }, []);

  const fetchOptIns = async () => {
    try {
      setLoading(true);
      const { data: optInData, error: optInError } = await supabase
        .from('sms_opt_ins')
        .select('*')
        .order('created_at', { ascending: false });

      if (optInError) throw optInError;

      const { data: salesPeopleData, error: salesPeopleError } = await supabase
        .from('sales_people')
        .select('user_id, name, email');

      if (salesPeopleError) throw salesPeopleError;

      const salesPeopleMap = new Map(
        salesPeopleData?.map((sp) => [sp.user_id, { name: sp.name, email: sp.email }]) || []
      );

      const enrichedOptIns = optInData?.map((optIn) => {
        const userInfo = salesPeopleMap.get(optIn.user_id);
        return {
          ...optIn,
          user_name: userInfo?.name || 'Unknown User',
          user_email: userInfo?.email || 'N/A',
        };
      }) || [];

      setOptIns(enrichedOptIns);
    } catch (error: any) {
      console.error('Error fetching SMS opt-ins:', error);
      alert('Failed to load SMS opt-in records');
    } finally {
      setLoading(false);
    }
  };

  const filteredOptIns = optIns.filter((optIn) => {
    const matchesSearch =
      optIn.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      optIn.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      optIn.phone_number.includes(searchTerm);

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'opted_in' && optIn.opted_in) ||
      (filterStatus === 'opted_out' && !optIn.opted_in);

    return matchesSearch && matchesFilter;
  });

  const exportToCSV = () => {
    const headers = [
      'User Name',
      'Email',
      'Phone Number',
      'Status',
      'Consent Date',
      'Opt-Out Date',
      'IP Address',
      'User Agent'
    ];

    const rows = filteredOptIns.map((optIn) => [
      optIn.user_name || 'N/A',
      optIn.user_email || 'N/A',
      optIn.phone_number,
      optIn.opted_in ? 'Opted In' : 'Opted Out',
      new Date(optIn.consent_timestamp).toLocaleString(),
      optIn.opt_out_timestamp ? new Date(optIn.opt_out_timestamp).toLocaleString() : 'N/A',
      optIn.ip_address || 'N/A',
      optIn.user_agent || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sms-opt-ins-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const stats = {
    total: optIns.length,
    optedIn: optIns.filter((o) => o.opted_in).length,
    optedOut: optIns.filter((o) => !o.opted_in).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading SMS opt-in records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 rounded-lg">
            <MessageSquare className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">SMS Opt-In Management</h2>
            <p className="text-sm text-slate-600">View and manage SMS notification consent records</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Records</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{stats.total}</p>
              </div>
              <MessageSquare className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Opted In</p>
                <p className="text-3xl font-bold text-green-900 mt-1">{stats.optedIn}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Opted Out</p>
                <p className="text-3xl font-bold text-red-900 mt-1">{stats.optedOut}</p>
              </div>
              <XCircle className="w-10 h-10 text-red-600 opacity-50" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="opted_in">Opted In</option>
              <option value="opted_out">Opted Out</option>
            </select>

            <button
              onClick={exportToCSV}
              disabled={filteredOptIns.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {filteredOptIns.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No SMS opt-in records found</p>
            <p className="text-sm text-slate-500 mt-1">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Records will appear here when users opt in to SMS notifications'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Consent Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Opt-Out Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOptIns.map((optIn) => (
                  <tr key={optIn.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{optIn.user_name}</p>
                          <p className="text-sm text-slate-600">{optIn.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-sm text-slate-700">{optIn.phone_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {optIn.opted_in ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Opted In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                          <XCircle className="w-3.5 h-3.5" />
                          Opted Out
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {new Date(optIn.consent_timestamp).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {optIn.opt_out_timestamp ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-700">
                            {new Date(optIn.opt_out_timestamp).toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {optIn.ip_address && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Globe className="w-3.5 h-3.5" />
                            <span className="font-mono">{optIn.ip_address}</span>
                          </div>
                        )}
                        {optIn.user_agent && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Monitor className="w-3.5 h-3.5" />
                            <span className="truncate max-w-xs" title={optIn.user_agent}>
                              {optIn.user_agent.substring(0, 40)}...
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
