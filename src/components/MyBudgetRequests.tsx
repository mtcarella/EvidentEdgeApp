import { useState, useEffect } from 'react';
import { DollarSign, Clock, Check, X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from './Toast';

interface BudgetRequest {
  id: string;
  request_date: string;
  buyer_borrower_name: string;
  file_number: string;
  transaction_type: 'purchase' | 'refi';
  relationship: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
}

export function MyBudgetRequests() {
  const { user, salesPerson } = useAuth();
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    request_date: new Date().toISOString().split('T')[0],
    buyer_borrower_name: '',
    file_number: '',
    transaction_type: 'purchase' as 'purchase' | 'refi',
    relationship: '',
  });

  useEffect(() => {
    if (user?.id) loadRequests();
  }, [user?.id]);

  const loadRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_budget_requests')
      .select('id, request_date, buyer_borrower_name, file_number, transaction_type, relationship, status, created_at, reviewed_at')
      .eq('requesting_user_id', user!.id)
      .order('created_at', { ascending: false });

    if (!error && data) setRequests(data as BudgetRequest[]);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      request_date: new Date().toISOString().split('T')[0],
      buyer_borrower_name: '',
      file_number: '',
      transaction_type: 'purchase',
      relationship: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !salesPerson) return;

    if (!formData.buyer_borrower_name.trim() || !formData.file_number.trim() || !formData.relationship.trim()) {
      setNotification({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('contact_budget_requests')
      .insert({
        requesting_user_id: user.id,
        requesting_user_name: salesPerson.name,
        request_date: formData.request_date,
        buyer_borrower_name: formData.buyer_borrower_name.trim(),
        file_number: formData.file_number.trim(),
        transaction_type: formData.transaction_type,
        relationship: formData.relationship.trim(),
      });

    if (error) {
      setNotification({ type: 'error', message: 'Failed to submit request' });
      setSubmitting(false);
      return;
    }

    // Send email notifications
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-budget-request`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'submitted',
            requestingUserName: salesPerson.name,
            requestingUserEmail: salesPerson.email,
            requestDate: formData.request_date,
            buyerBorrowerName: formData.buyer_borrower_name.trim(),
            fileNumber: formData.file_number.trim(),
            transactionType: formData.transaction_type,
            relationship: formData.relationship.trim(),
          }),
        }).catch(err => console.error('Notification error:', err));
      }
    } catch (err) {
      console.error('Notification error:', err);
    }

    setNotification({ type: 'success', message: 'Friends and Family request submitted successfully' });
    resetForm();
    setShowForm(false);
    setSubmitting(false);
    loadRequests();
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {notification && (
        <Toast type={notification.type} message={notification.message} onClose={() => setNotification(null)} />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-emerald-700 to-emerald-800 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">My Friends and Family Requests</h2>
                <p className="text-sm text-emerald-100 mt-0.5">Submit and track your Friends and Family requests</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
            >
              {showForm ? <X className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'New Request'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="p-6 border-b border-slate-200 bg-emerald-50/50">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.request_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, request_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">File Number *</label>
                  <input
                    type="text"
                    value={formData.file_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, file_number: e.target.value }))}
                    placeholder="Enter file number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buyer/Borrower Name *</label>
                  <input
                    type="text"
                    value={formData.buyer_borrower_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, buyer_borrower_name: e.target.value }))}
                    placeholder="Enter buyer/borrower name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Relationship to Buyer/Borrower *</label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
                    placeholder="e.g., Attorney, Loan Officer, Realtor"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Transaction Type *</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transaction_type"
                      value="purchase"
                      checked={formData.transaction_type === 'purchase'}
                      onChange={() => setFormData(prev => ({ ...prev, transaction_type: 'purchase' }))}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">Purchase <span className="text-slate-500">($100 deduction)</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transaction_type"
                      value="refi"
                      checked={formData.transaction_type === 'refi'}
                      onChange={() => setFormData(prev => ({ ...prev, transaction_type: 'refi' }))}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">Refi <span className="text-slate-500">($50 deduction)</span></span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">You have no Friends and Family requests yet</p>
              <p className="text-sm text-slate-400 mt-1">Click "New Request" to submit one</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-semibold text-slate-700">Date</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-700">Buyer/Borrower</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-700">File #</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-700">Type</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-700">Relationship</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3 text-slate-600">{formatDate(req.request_date)}</td>
                      <td className="py-3 px-3 font-medium text-slate-900">{req.buyer_borrower_name}</td>
                      <td className="py-3 px-3 text-slate-600">{req.file_number}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          req.transaction_type === 'purchase' ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800'
                        }`}>
                          {req.transaction_type === 'purchase' ? 'Purchase' : 'Refi'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{req.relationship}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={req.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    rejected: 'bg-red-100 text-red-800',
  };
  const icons: Record<string, typeof Clock> = {
    pending: Clock,
    approved: Check,
    rejected: X,
  };
  const Icon = icons[status] || Clock;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
