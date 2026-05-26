import { useState, useEffect } from 'react';
import { UserPlus, Clock, Check, X, AlertCircle, ChevronDown, ChevronUp, CreditCard as Edit3, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { Toast } from './Toast';

interface ProspectRequest {
  id: string;
  submitted_by_user_id: string;
  submitted_by_name: string;
  prospect_name: string;
  prospect_details: Record<string, any>;
  date_met: string;
  where_met: string;
  why_good_client: string;
  additional_info: string | null;
  status: 'pending' | 'approved' | 'denied';
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

type Tab = 'pending' | 'approved' | 'denied';

const SUPER_ADMIN_EMAIL = 'mtcarella@evidenttitle.com';
const SUPER_ADMIN_NAME = 'Mike Carella';

const TYPE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  realtor: 'Realtor',
  attorney: 'Attorney',
  loan_officer: 'Loan Officer',
  vendor: 'Vendor',
};

export function ProspectRequests() {
  const { user, salesPerson } = useAuth();
  const dialog = useDialog();
  const isSuperAdmin = salesPerson?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<ProspectRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDetails, setEditDetails] = useState<Record<string, any>>({});
  const [editFormFields, setEditFormFields] = useState<{ where_met: string; why_good_client: string; additional_info: string; admin_notes: string }>({ where_met: '', why_good_client: '', additional_info: '', admin_notes: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [salespeople, setSalespeople] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadRequests();
    loadSalespeople();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  const loadRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prospect_requests')
      .select('*')
      .eq('status', activeTab)
      .order('created_at', { ascending: activeTab === 'pending' });

    if (!error && data) setRequests(data as ProspectRequest[]);
    setLoading(false);
  };

  const loadSalespeople = async () => {
    const { data } = await supabase
      .from('sales_people')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (data) setSalespeople(data);
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

  const sendNotificationEmail = async (params: {
    to: { name: string; email: string }[];
    subject: string;
    message: string;
    senderEmail?: string;
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-communication`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'email',
          recipients: params.to,
          subject: params.subject,
          message: params.message,
          senderEmail: params.senderEmail,
        }),
      });
    } catch (err) {
      console.error('Email send error:', err);
    }
  };

  const startEditing = (request: ProspectRequest) => {
    setEditingId(request.id);
    setEditDetails({ ...request.prospect_details });
    setEditFormFields({
      where_met: request.where_met,
      why_good_client: request.why_good_client,
      additional_info: request.additional_info || '',
      admin_notes: request.admin_notes || '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDetails({});
    setEditFormFields({ where_met: '', why_good_client: '', additional_info: '', admin_notes: '' });
  };

  const saveEdits = async (request: ProspectRequest) => {
    try {
      const prospectName = [editDetails.first_name, editDetails.last_name].filter(Boolean).join(' ') || editDetails.company || request.prospect_name;

      const { error } = await supabase
        .from('prospect_requests')
        .update({
          prospect_details: editDetails,
          prospect_name: prospectName,
          where_met: editFormFields.where_met,
          why_good_client: editFormFields.why_good_client,
          additional_info: editFormFields.additional_info || null,
          admin_notes: editFormFields.admin_notes || null,
        })
        .eq('id', request.id);

      if (error) throw error;

      setNotification({ type: 'success', message: 'Changes saved' });
      setEditingId(null);
      loadRequests();
    } catch (err: any) {
      setNotification({ type: 'error', message: `Failed to save: ${err.message}` });
    }
  };

  const decideRequest = async (request: ProspectRequest, approve: boolean) => {
    if (!user) return;

    const action = approve ? 'approve' : 'deny';
    if (!(await dialog.confirm(`Are you sure you want to ${action} this prospect request for "${request.prospect_name}"?`))) return;

    try {
      const details = editingId === request.id ? editDetails : request.prospect_details;
      const adminNotes = editingId === request.id ? editFormFields.admin_notes : request.admin_notes;

      const { error: updateError } = await supabase
        .from('prospect_requests')
        .update({
          status: approve ? 'approved' : 'denied',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_notes: adminNotes || null,
          ...(editingId === request.id ? {
            prospect_details: details,
            prospect_name: [details.first_name, details.last_name].filter(Boolean).join(' ') || details.company || request.prospect_name,
            where_met: editFormFields.where_met,
            why_good_client: editFormFields.why_good_client,
            additional_info: editFormFields.additional_info || null,
          } : {}),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      if (approve) {
        const contactData = {
          first_name: details.first_name || null,
          last_name: details.last_name || null,
          email: details.email || null,
          phone: details.phone || null,
          cell_phone: details.cell_phone || null,
          company: details.company || null,
          branch: details.branch || null,
          address: details.address || null,
          notes: details.notes || null,
          type: details.type || 'buyer',
          assigned_to: details.assigned_to,
          created_by: request.submitted_by_user_id,
          updated_by: user.id,
          client_identifier_no: details.client_identifier_no || null,
          evident_paralegal: details.evident_paralegal || null,
          client_paralegal_processor: details.client_paralegal_processor || null,
          preferred_surveyor: details.preferred_surveyor || null,
          preferred_uw: details.preferred_uw || null,
          preferred_closer: details.preferred_closer || null,
          birthday: details.birthday || null,
          drinks: details.drinks ?? true,
          client_type: details.client_type || 'prospect',
          grade: details.grade || 'C',
          marketing_points: details.marketing_points || 0,
          processor_notes: details.processor_notes || null,
        };

        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert(contactData)
          .select()
          .single();

        if (contactError) throw contactError;

        if (newContact && details.assigned_to) {
          await supabase.from('assignments').insert({
            contact_id: newContact.id,
            salesperson_id: details.assigned_to,
            assigned_by: user.id,
          });
        }
      }

      const { data: submitter } = await supabase
        .from('sales_people')
        .select('email')
        .eq('user_id', request.submitted_by_user_id)
        .maybeSingle();

      const submitterEmail = submitter?.email || '';
      if (submitterEmail) {
        const subject = `Prospect Request ${approve ? 'Approved' : 'Denied'} - ${request.prospect_name}`;
        const message = `Your prospect request for "${request.prospect_name}" has been ${approve ? 'APPROVED' : 'DENIED'}.

${approve
  ? 'The prospect has been added to the contacts system. You can now find them in your contacts list.'
  : 'Please contact Mike Carella if you have questions about this decision.'}`;

        const recipients = [{ name: request.submitted_by_name, email: submitterEmail }];
        if (submitterEmail.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
          recipients.push({ name: SUPER_ADMIN_NAME, email: SUPER_ADMIN_EMAIL });
        }

        await sendNotificationEmail({ to: recipients, subject, message });
      }

      setNotification({ type: 'success', message: `Request ${approve ? 'approved' : 'denied'}` });
      setEditingId(null);
      loadRequests();
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: `Failed to ${approve ? 'approve' : 'deny'} request: ${err.message}` });
    }
  };

  const pendingCount = activeTab === 'pending' ? requests.length : 0;

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12 text-slate-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>Only super admins can manage prospect requests.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {notification && (
        <Toast type={notification.type} message={notification.message} onClose={() => setNotification(null)} />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-cyan-700 to-cyan-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Prospect Requests</h2>
              <p className="text-sm text-cyan-100 mt-0.5">Review and manage new prospect submissions</p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 px-4">
          <div className="flex gap-1 overflow-x-auto">
            <TabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} icon={Clock} label="Pending" badge={pendingCount} badgeColor="bg-red-500" />
            <TabButton active={activeTab === 'approved'} onClick={() => setActiveTab('approved')} icon={Check} label="Approved" />
            <TabButton active={activeTab === 'denied'} onClick={() => setActiveTab('denied')} icon={X} label="Denied" />
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No {activeTab} prospect requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const isEditing = editingId === req.id;
                const isExpanded = expandedId === req.id;
                const details = isEditing ? editDetails : req.prospect_details;
                const assignedName = salespeople.find(s => s.id === details?.assigned_to)?.name || 'Unassigned';

                return (
                  <div
                    key={req.id}
                    className={`border rounded-lg transition-all ${
                      activeTab === 'pending'
                        ? 'border-2 border-amber-200 bg-amber-50/50'
                        : activeTab === 'approved'
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-red-200 bg-red-50/30'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-lg">{req.prospect_name}</span>
                            <StatusBadge status={req.status} />
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                              {TYPE_LABELS[details?.type] || details?.type || 'Unknown'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                            <div><span className="font-medium text-slate-700">Submitted By:</span> {req.submitted_by_name}</div>
                            <div><span className="font-medium text-slate-700">Assigned To:</span> {assignedName}</div>
                            <div><span className="font-medium text-slate-700">Date Met:</span> {formatDate(req.date_met)}</div>
                            <div><span className="font-medium text-slate-700">Submitted:</span> {new Date(req.created_at).toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : req.id)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {isExpanded ? 'Less' : 'Details'}
                          </button>

                          {activeTab === 'pending' && (
                            <>
                              {!isEditing ? (
                                <button
                                  onClick={() => startEditing(req)}
                                  className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                                >
                                  <Edit3 className="w-4 h-4" /> Edit
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => saveEdits(req)}
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                                  >
                                    <Save className="w-4 h-4" /> Save
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => decideRequest(req, true)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
                              >
                                <Check className="w-4 h-4" /> Approve
                              </button>
                              <button
                                onClick={() => decideRequest(req, false)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
                              >
                                <X className="w-4 h-4" /> Deny
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="text-sm">
                          <span className="font-medium text-slate-700">Where Met:</span>{' '}
                          {isEditing ? (
                            <input
                              type="text"
                              value={editFormFields.where_met}
                              onChange={(e) => setEditFormFields({ ...editFormFields, where_met: e.target.value })}
                              className="ml-1 px-2 py-1 border border-slate-300 rounded text-sm w-full max-w-md"
                            />
                          ) : (
                            <span className="text-slate-600">{req.where_met}</span>
                          )}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-slate-700">Why Good Client:</span>{' '}
                          {isEditing ? (
                            <textarea
                              value={editFormFields.why_good_client}
                              onChange={(e) => setEditFormFields({ ...editFormFields, why_good_client: e.target.value })}
                              rows={2}
                              className="ml-1 px-2 py-1 border border-slate-300 rounded text-sm w-full max-w-lg resize-none"
                            />
                          ) : (
                            <span className="text-slate-600">{req.why_good_client}</span>
                          )}
                        </div>
                        {(req.additional_info || isEditing) && (
                          <div className="text-sm">
                            <span className="font-medium text-slate-700">Additional Info:</span>{' '}
                            {isEditing ? (
                              <textarea
                                value={editFormFields.additional_info}
                                onChange={(e) => setEditFormFields({ ...editFormFields, additional_info: e.target.value })}
                                rows={2}
                                className="ml-1 px-2 py-1 border border-slate-300 rounded text-sm w-full max-w-lg resize-none"
                              />
                            ) : (
                              <span className="text-slate-600">{req.additional_info}</span>
                            )}
                          </div>
                        )}
                        {activeTab === 'pending' && (
                          <div className="text-sm">
                            <span className="font-medium text-slate-700">Admin Notes:</span>{' '}
                            {isEditing ? (
                              <textarea
                                value={editFormFields.admin_notes}
                                onChange={(e) => setEditFormFields({ ...editFormFields, admin_notes: e.target.value })}
                                rows={2}
                                placeholder="Internal notes (not shared with submitter)..."
                                className="ml-1 px-2 py-1 border border-slate-300 rounded text-sm w-full max-w-lg resize-none"
                              />
                            ) : (
                              <span className="text-slate-500 italic">{req.admin_notes || 'None'}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {req.reviewed_at && (
                        <div className="text-xs text-slate-500 mt-2">
                          Decided {new Date(req.reviewed_at).toLocaleString()}
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 p-4 bg-white/60">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">Prospect Details</h4>
                        {isEditing ? (
                          <EditableProspectDetails
                            details={editDetails}
                            onDetailsChange={setEditDetails}
                            salespeople={salespeople}
                          />
                        ) : (
                          <ProspectDetailsView details={details} salespeople={salespeople} />
                        )}
                        {req.admin_notes && activeTab !== 'pending' && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <span className="text-sm font-medium text-amber-800">Admin Notes:</span>
                            <p className="text-sm text-amber-700 mt-1">{req.admin_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, badge, badgeColor = 'bg-blue-600' }: {
  active: boolean; onClick: () => void; icon: any; label: string; badge?: number; badgeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors whitespace-nowrap relative ${
        active ? 'text-cyan-700 border-b-2 border-cyan-700' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`${badgeColor} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}>{badge}</span>
      )}
    </button>
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

function ProspectDetailsView({ details, salespeople }: { details: Record<string, any>; salespeople: { id: string; name: string }[] }) {
  if (!details) return null;

  const fields = [
    { label: 'First Name', value: details.first_name },
    { label: 'Last Name', value: details.last_name },
    { label: 'Email', value: details.email },
    { label: 'Phone', value: details.phone },
    { label: 'Cell Phone', value: details.cell_phone },
    { label: 'Company', value: details.company },
    { label: 'Branch', value: details.branch },
    { label: 'Address', value: details.address },
    { label: 'Client Type', value: details.client_type },
    { label: 'Grade', value: details.grade },
    { label: 'Marketing Points', value: details.marketing_points },
    { label: 'Drinks', value: details.drinks ? 'Yes' : 'No' },
    { label: 'Birthday', value: details.birthday },
    { label: 'Client Identifier No.', value: details.client_identifier_no },
    { label: 'Evident Paralegal', value: details.evident_paralegal },
    { label: 'Client Paralegal/Processor', value: details.client_paralegal_processor },
    { label: 'Preferred Surveyor', value: details.preferred_surveyor },
    { label: 'Preferred UW', value: details.preferred_uw },
    { label: 'Preferred Closer', value: details.preferred_closer },
    { label: 'Assigned To', value: salespeople.find(s => s.id === details.assigned_to)?.name },
    { label: 'Notes', value: details.notes },
    { label: 'Processor Notes', value: details.processor_notes },
  ].filter(f => f.value !== null && f.value !== undefined && f.value !== '' && f.value !== 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {fields.map((field) => (
        <div key={field.label} className="text-sm">
          <span className="font-medium text-slate-700">{field.label}:</span>{' '}
          <span className="text-slate-600">{String(field.value)}</span>
        </div>
      ))}
    </div>
  );
}

function EditableProspectDetails({ details, onDetailsChange, salespeople }: {
  details: Record<string, any>;
  onDetailsChange: (d: Record<string, any>) => void;
  salespeople: { id: string; name: string }[];
}) {
  const update = (key: string, value: any) => {
    onDetailsChange({ ...details, [key]: value });
  };

  const inputClass = 'px-2 py-1.5 border border-slate-300 rounded text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
        <input type="text" value={details.first_name || ''} onChange={(e) => update('first_name', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
        <input type="text" value={details.last_name || ''} onChange={(e) => update('last_name', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
        <input type="email" value={details.email || ''} onChange={(e) => update('email', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
        <input type="tel" value={details.phone || ''} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Cell Phone</label>
        <input type="tel" value={details.cell_phone || ''} onChange={(e) => update('cell_phone', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Company</label>
        <input type="text" value={details.company || ''} onChange={(e) => update('company', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
        <select value={details.type || 'buyer'} onChange={(e) => update('type', e.target.value)} className={inputClass}>
          <option value="buyer">Buyer</option>
          <option value="realtor">Realtor</option>
          <option value="attorney">Attorney</option>
          <option value="loan_officer">Loan Officer</option>
          <option value="vendor">Vendor</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
        <select value={details.assigned_to || ''} onChange={(e) => update('assigned_to', e.target.value)} className={inputClass}>
          {salespeople.map((sp) => (
            <option key={sp.id} value={sp.id}>{sp.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
        <select value={details.branch || ''} onChange={(e) => update('branch', e.target.value)} className={inputClass}>
          <option value="">None</option>
          <option value="ETA 1">ETA 1</option>
          <option value="ETA 2">ETA 2</option>
          <option value="ETA 3">ETA 3</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Grade</label>
        <select value={details.grade || 'C'} onChange={(e) => update('grade', e.target.value)} className={inputClass}>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Client Type</label>
        <select value={details.client_type || 'prospect'} onChange={(e) => update('client_type', e.target.value)} className={inputClass}>
          <option value="prospect">Prospect</option>
          <option value="client">Client</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Drinks</label>
        <select value={details.drinks ? 'yes' : 'no'} onChange={(e) => update('drinks', e.target.value === 'yes')} className={inputClass}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
        <input type="text" value={details.address || ''} onChange={(e) => update('address', e.target.value)} className={inputClass} />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={details.notes || ''} onChange={(e) => update('notes', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
      </div>
    </div>
  );
}
