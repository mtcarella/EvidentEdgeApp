import { useState, useEffect } from 'react';
import { UserPlus, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ProspectRequest {
  id: string;
  prospect_name: string;
  status: 'pending' | 'approved' | 'denied';
  date_met: string;
  where_met: string;
  created_at: string;
  reviewed_at: string | null;
}

export function MyProspectRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ProspectRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) loadRequests();
  }, [user?.id]);

  const loadRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prospect_requests')
      .select('id, prospect_name, status, date_met, where_met, created_at, reviewed_at')
      .eq('submitted_by_user_id', user!.id)
      .order('created_at', { ascending: false });

    if (!error && data) setRequests(data as ProspectRequest[]);
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-cyan-700 to-cyan-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">My Prospect Requests</h2>
              <p className="text-sm text-cyan-100 mt-0.5">Track the status of your submitted prospect requests</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">You have no prospect requests yet</p>
              <p className="text-sm text-slate-400 mt-1">Submit a new prospect from the Add Prospect page</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900">{req.prospect_name}</div>
                      <div className="text-sm text-slate-600 mt-1">Met on {formatDate(req.date_met)} — {req.where_met}</div>
                      <div className="text-xs text-slate-500 mt-2">
                        Submitted {new Date(req.created_at).toLocaleString()}
                        {req.reviewed_at && (
                          <span> — Decided {new Date(req.reviewed_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    denied: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}
