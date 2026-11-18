import { useState, useEffect } from 'react';
import { DollarSign, Clock, Check, X, AlertCircle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { Toast } from './Toast';
import { deductBudget, restoreBudget } from '../lib/budgetUtils';

interface BudgetRequest {
  id: string;
  created_at: string;
  request_date: string;
  requesting_user_id: string;
  requesting_user_name: string;
  buyer_borrower_name: string;
  file_number: string;
  transaction_type: 'purchase' | 'refi';
  relationship: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name?: string | null;
  finalized: boolean;
  finalized_at: string | null;
  finalized_by: string | null;
  finalized_by_name?: string | null;
  budget_deducted: boolean;
}

type Tab = 'pending' | 'approved' | 'rejected';

export function ContactBudgetRequests() {
  const { user, salesPerson, refreshSalesPerson } = useAuth();
  const dialog = useDialog();

  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  const loadRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_budget_requests')
      .select('*')
      .eq('status', activeTab)
      .order('created_at', { ascending: activeTab === 'pending' });

    if (!error && data) {
      if (activeTab !== 'pending' && data.length > 0) {
        const reviewerIds = [...new Set(data.flatMap(r => [r.reviewed_by, r.finalized_by]).filter(Boolean))];
        if (reviewerIds.length > 0) {
          const { data: reviewers } = await supabase
            .from('sales_people')
            .select('user_id, name')
            .in('user_id', reviewerIds);

          const reviewerMap = new Map((reviewers || []).map(r => [r.user_id, r.name]));
          setRequests(data.map(r => ({
            ...r,
            reviewed_by_name: r.reviewed_by ? reviewerMap.get(r.reviewed_by) || null : null,
            finalized_by_name: r.finalized_by ? reviewerMap.get(r.finalized_by) || null : null,
          })) as BudgetRequest[]);
        } else {
          setRequests(data as BudgetRequest[]);
        }
      } else {
        setRequests(data as BudgetRequest[]);
      }
    } else if (error) {
      setNotification({ type: 'error', message: 'Failed to load requests' });
    }
    setLoading(false);
  };

  const toggleFinalized = async (request: BudgetRequest) => {
    const finalized = !request.finalized;
    const amount = getDeductionAmount(request.transaction_type);

    const confirmed = await dialog.confirm(
      finalized
        ? `Mark this request as finalized?${request.budget_deducted ? '' : ` This will deduct $${amount} from ${request.requesting_user_name}'s budget.`}`
        : `Mark this request as not finalized?${request.budget_deducted ? ` The $${amount} will be returned to ${request.requesting_user_name}'s budget.` : ''}`,
      finalized ? 'Finalize Request' : 'Undo Finalized'
    );
    if (!confirmed) return;

    const update = {
      finalized,
      finalized_at: finalized ? new Date().toISOString() : null,
      finalized_by: finalized ? user!.id : null,
    };

    setTogglingId(request.id);
    const result = await applyFinalized(request, update, amount);
    setTogglingId(null);

    if (!result.ok) {
      setNotification({ type: 'error', message: result.message });
      loadRequests();
      return;
    }

    setRequests(prev => prev.map(r => r.id === request.id
      ? { ...r, ...update, budget_deducted: result.deducted, finalized_by_name: finalized ? salesPerson?.name || null : null }
      : r));
    setNotification({ type: 'success', message: result.message });
    refreshSalesPerson();
  };

  const applyFinalized = async (
    request: BudgetRequest,
    update: { finalized: boolean; finalized_at: string | null; finalized_by: string | null },
    amount: number
  ): Promise<{ ok: true; deducted: boolean; message: string } | { ok: false; message: string }> => {
    const finalized = update.finalized;
    const description = `Friends and Family: ${request.buyer_borrower_name} (File ${request.file_number})`;

    // Flip budget_deducted only if it is still in the opposite state, so a double click can't charge or refund twice.
    const { data: claimed, error: claimError } = await supabase
      .from('contact_budget_requests')
      .update({ ...update, budget_deducted: finalized })
      .eq('id', request.id)
      .eq('status', 'approved')
      .eq('budget_deducted', !finalized)
      .select('id');

    if (claimError) return { ok: false, message: 'Failed to update finalized status' };

    if (!claimed || claimed.length === 0) {
      const { error } = await supabase
        .from('contact_budget_requests')
        .update(update)
        .eq('id', request.id);
      if (error) return { ok: false, message: 'Failed to update finalized status' };
      return { ok: true, deducted: finalized, message: finalized ? 'Request marked as finalized.' : 'Request marked as not finalized.' };
    }

    const { data: reqSalesPerson } = await supabase
      .from('sales_people')
      .select('id')
      .eq('user_id', request.requesting_user_id)
      .maybeSingle();

    const budgetResult = reqSalesPerson
      ? finalized
        ? await deductBudget(reqSalesPerson.id, amount, 'regular', description)
        : await restoreBudget(reqSalesPerson.id, amount, 'regular', `${description} - finalization undone`)
      : { success: false, error: 'Could not find requesting user' };

    if (!budgetResult.success) {
      await supabase
        .from('contact_budget_requests')
        .update({
          finalized: request.finalized,
          finalized_at: request.finalized_at,
          finalized_by: request.finalized_by,
          budget_deducted: request.budget_deducted,
        })
        .eq('id', request.id);
      return { ok: false, message: `Budget ${finalized ? 'deduction' : 'refund'} failed: ${budgetResult.error}` };
    }

    return {
      ok: true,
      deducted: finalized,
      message: finalized
        ? `Request finalized. $${amount} deducted from ${request.requesting_user_name}'s budget.`
        : `Request marked as not finalized. $${amount} returned to ${request.requesting_user_name}'s budget.`,
    };
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDeductionAmount = (type: string) => type === 'purchase' ? 100 : 50;

  const sendNotificationEmail = async (request: BudgetRequest, status: 'approved' | 'rejected') => {
    try {
      // Look up the requesting user's email
      const { data: reqUser } = await supabase
        .from('sales_people')
        .select('email')
        .eq('user_id', request.requesting_user_id)
        .maybeSingle();

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-budget-request`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'reviewed',
            requestingUserName: request.requesting_user_name,
            requestingUserEmail: reqUser?.email || '',
            requestDate: request.request_date,
            buyerBorrowerName: request.buyer_borrower_name,
            fileNumber: request.file_number,
            transactionType: request.transaction_type,
            relationship: request.relationship,
            status,
          }),
        }).catch(err => console.error('Notification error:', err));
      }
    } catch (err) {
      console.error('Notification error:', err);
    }
  };

  const handleApprove = async (request: BudgetRequest) => {
    const confirmed = await dialog.confirm(
      `Approve this Friends and Family request? ${request.requesting_user_name}'s budget will not be reduced until the request is marked as finalized.`,
      'Approve Request'
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('contact_budget_requests')
      .update({
        status: 'approved',
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (error) {
      setNotification({ type: 'error', message: 'Failed to update request status' });
      return;
    }

    setNotification({ type: 'success', message: 'Request approved. The budget will be reduced once it is marked as finalized.' });
    sendNotificationEmail(request, 'approved');
    loadRequests();
  };

  const handleReject = async (request: BudgetRequest) => {
    const confirmed = await dialog.confirm(
      `Reject this Friends and Family request from ${request.requesting_user_name}? No budget deduction will occur.`,
      'Reject Request'
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('contact_budget_requests')
      .update({
        status: 'rejected',
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (error) {
      setNotification({ type: 'error', message: 'Failed to update request status' });
      return;
    }

    setNotification({ type: 'success', message: 'Request rejected. No budget change applied.' });
    sendNotificationEmail(request, 'rejected');
    loadRequests();
  };

  const tabs: { id: Tab; label: string; color: string }[] = [
    { id: 'pending', label: 'Pending', color: 'amber' },
    { id: 'approved', label: 'Approved', color: 'green' },
    { id: 'rejected', label: 'Rejected', color: 'red' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {notification && (
        <Toast type={notification.type} message={notification.message} onClose={() => setNotification(null)} />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-emerald-700 to-emerald-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Friends and Family Requests</h2>
              <p className="text-sm text-emerald-100 mt-0.5">Review and manage Friends and Family requests from sales team</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? `text-${tab.color}-700 border-b-2 border-${tab.color}-500 bg-${tab.color}-50/50`
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && requests.length > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full bg-${tab.color}-100 text-${tab.color}-700`}>
                  {requests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No {activeTab} Friends and Family requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="border border-slate-200 rounded-lg hover:border-slate-300 transition-colors overflow-hidden"
                >
                  <div
                    className="p-4 flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{req.buyer_borrower_name}</span>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          req.transaction_type === 'purchase' ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800'
                        }`}>
                          {req.transaction_type === 'purchase' ? 'Purchase ($100)' : 'Refi ($50)'}
                        </span>
                        {req.finalized && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-white">
                            <CheckCircle2 className="w-3 h-3" /> Finalized
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        <span className="font-medium">From:</span> {req.requesting_user_name} — <span className="font-medium">File:</span> {req.file_number}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Submitted {new Date(req.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {activeTab === 'pending' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(req); }}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReject(req); }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {activeTab === 'approved' && (
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer select-none transition-colors ${
                            req.finalized
                              ? 'bg-slate-800 border-slate-800 text-white hover:bg-slate-700'
                              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                          } ${togglingId === req.id ? 'opacity-60 pointer-events-none' : ''}`}
                          title={req.finalized ? 'Uncheck to mark as not finalized' : `Check once finalized - deducts $${getDeductionAmount(req.transaction_type)} from the budget`}
                        >
                          <input
                            type="checkbox"
                            checked={req.finalized}
                            onChange={() => toggleFinalized(req)}
                            disabled={togglingId === req.id}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          Finalized
                        </label>
                      )}
                      {expandedId === req.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {expandedId === req.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-sm">
                        <div><span className="font-medium text-slate-700">Date:</span> <span className="text-slate-600">{formatDate(req.request_date)}</span></div>
                        <div><span className="font-medium text-slate-700">File Number:</span> <span className="text-slate-600">{req.file_number}</span></div>
                        <div><span className="font-medium text-slate-700">Buyer/Borrower:</span> <span className="text-slate-600">{req.buyer_borrower_name}</span></div>
                        <div><span className="font-medium text-slate-700">Relationship:</span> <span className="text-slate-600">{req.relationship}</span></div>
                        <div><span className="font-medium text-slate-700">Transaction Type:</span> <span className="text-slate-600">{req.transaction_type === 'purchase' ? 'Purchase ($100)' : 'Refi ($50)'}</span></div>
                        <div><span className="font-medium text-slate-700">Requested By:</span> <span className="text-slate-600">{req.requesting_user_name}</span></div>
                        {req.reviewed_at && (
                          <div><span className="font-medium text-slate-700">Reviewed:</span> <span className="text-slate-600">{new Date(req.reviewed_at).toLocaleString()}</span></div>
                        )}
                        {req.reviewed_by_name && (
                          <div><span className="font-medium text-slate-700">Reviewed By:</span> <span className="text-slate-600">{req.reviewed_by_name}</span></div>
                        )}
                        {req.finalized && req.finalized_at && (
                          <div><span className="font-medium text-slate-700">Finalized:</span> <span className="text-slate-600">{new Date(req.finalized_at).toLocaleString()}{req.finalized_by_name ? ` by ${req.finalized_by_name}` : ''}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
