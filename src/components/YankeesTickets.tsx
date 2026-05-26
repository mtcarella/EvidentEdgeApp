import { useState, useEffect } from 'react';
import { Calendar, Ticket, Upload, Check, X, Clock, Send, AlertCircle, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { Toast } from './Toast';

interface YankeesTicket {
  id: string;
  game_date: string;
  game_time: string;
  day_of_week: string;
  opponent: string;
  season_year: number;
  is_available: boolean;
  notes: string;
}

interface TicketRequest {
  id: string;
  ticket_id: string;
  requester_user_id: string;
  requester_name: string;
  requester_email: string;
  client_name: string;
  client_email: string;
  game_date: string;
  status: 'pending' | 'approved' | 'denied';
  admin_notes: string;
  decided_at: string | null;
  created_at: string;
  ticket?: YankeesTicket;
}

type Tab = 'available' | 'my-requests' | 'admin-requests' | 'admin-upload';

const SUPER_ADMIN_EMAIL = 'mtcarella@evidenttitle.com';
const SUPER_ADMIN_NAME = 'Mike Carella';

export function YankeesTickets() {
  const { user, salesPerson } = useAuth();
  const dialog = useDialog();
  const isSuperAdmin = salesPerson?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<Tab>('available');
  const [tickets, setTickets] = useState<YankeesTicket[]>([]);
  const [myRequests, setMyRequests] = useState<TicketRequest[]>([]);
  const [allRequests, setAllRequests] = useState<TicketRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [requestModalTicket, setRequestModalTicket] = useState<YankeesTicket | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<any[]>([]);
  const [uploadYear, setUploadYear] = useState<number>(new Date().getFullYear());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadTickets();
    loadMyRequests();
    if (isSuperAdmin) {
      loadAllRequests();
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'available') {
      loadTickets();
    } else if (activeTab === 'my-requests') {
      loadMyRequests();
    } else if (activeTab === 'admin-requests' && isSuperAdmin) {
      loadAllRequests();
      loadTickets();
    }
  }, [activeTab]);

  const loadTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('yankees_tickets')
      .select('*')
      .order('game_date', { ascending: true });

    if (!error && data) setTickets(data);
    setLoading(false);
  };

  const loadMyRequests = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('yankees_ticket_requests')
      .select('*, ticket:yankees_tickets(*)')
      .eq('requester_user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) setMyRequests(data as TicketRequest[]);
  };

  const loadAllRequests = async () => {
    const { data, error } = await supabase
      .from('yankees_ticket_requests')
      .select('*, ticket:yankees_tickets(*)')
      .order('created_at', { ascending: false });

    if (!error && data) setAllRequests(data as TicketRequest[]);
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

  const parseDate = (raw: unknown): string | null => {
    if (raw instanceof Date) {
      const y = raw.getUTCFullYear();
      const m = raw.getUTCMonth() + 1;
      const d = raw.getUTCDate();
      if (!isNaN(y)) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return null;
    }
    if (typeof raw === 'number' && raw > 59 && raw < 200000) {
      const ms = (raw - 25569) * 86400 * 1000;
      const dt = new Date(ms);
      if (!isNaN(dt.getTime())) {
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      }
    }
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return null;
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts.map((p) => parseInt(p, 10));
      if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
        const year = y < 100 ? 2000 + y : y;
        return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return null;
  };

  const handleFileSelect = async (file: File) => {
    setUploadFile(file);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const parsed = rows
        .map((row) => {
          const dateRaw = row.Date ?? row.date ?? row['Game Date'] ?? '';
          const game_date = parseDate(dateRaw);
          return {
            game_date,
            game_time: String(row.Time || row.time || ''),
            day_of_week: String(row.Day || row.day || ''),
            opponent: String(row.Opponent || row.opponent || ''),
            valid: !!game_date && !!(row.Opponent || row.opponent),
          };
        })
        .filter((r) => r.game_date && r.opponent);

      setUploadPreview(parsed);
      if (parsed.length === 0) {
        setNotification({ type: 'error', message: 'No valid rows found. Required columns: Date, Time, Day, Opponent' });
      }
    } catch (err) {
      console.error('Parse error:', err);
      setNotification({ type: 'error', message: 'Failed to parse file. Please verify it is a valid Excel/CSV file.' });
      setUploadPreview([]);
    }
  };

  const handleConfirmUpload = async () => {
    if (uploadPreview.length === 0) return;

    if (!(await dialog.confirm(`This will replace all ${uploadYear} tickets with ${uploadPreview.length} new entries. Continue?`))) {
      return;
    }

    setUploading(true);
    try {
      const { error: deleteError } = await supabase
        .from('yankees_tickets')
        .delete()
        .eq('season_year', uploadYear);

      if (deleteError) throw deleteError;

      const inserts = uploadPreview.map((row) => ({
        game_date: row.game_date,
        game_time: row.game_time,
        day_of_week: row.day_of_week,
        opponent: row.opponent,
        season_year: uploadYear,
        is_available: true,
      }));

      const { error: insertError } = await supabase
        .from('yankees_tickets')
        .insert(inserts);

      if (insertError) throw insertError;

      setNotification({ type: 'success', message: `Successfully uploaded ${inserts.length} games for ${uploadYear}` });
      setUploadFile(null);
      setUploadPreview([]);
      loadTickets();
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: `Upload failed: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  const openRequestModal = (ticket: YankeesTicket) => {
    setRequestModalTicket(ticket);
    setClientName('');
    setClientEmail('');
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submitRequest = async () => {
    if (!requestModalTicket || !user) return;

    if (!clientName.trim() || clientName.trim().length < 2) {
      setNotification({ type: 'error', message: 'Please enter a valid client name' });
      return;
    }
    if (!validateEmail(clientEmail.trim())) {
      setNotification({ type: 'error', message: 'Please enter a valid email address' });
      return;
    }

    setSubmittingRequest(true);
    try {
      const requesterName = salesPerson?.name || user.email || 'Unknown';
      const requesterEmail = salesPerson?.email || user.email || '';

      const { data: inserted, error } = await supabase
        .from('yankees_ticket_requests')
        .insert({
          ticket_id: requestModalTicket.id,
          requester_user_id: user.id,
          requester_name: requesterName,
          requester_email: requesterEmail,
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          game_date: requestModalTicket.game_date,
          status: 'pending',
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      await sendNotificationEmail({
        to: [{ name: SUPER_ADMIN_NAME, email: SUPER_ADMIN_EMAIL }],
        subject: `Yankees Ticket Request - ${formatDate(requestModalTicket.game_date)} vs ${requestModalTicket.opponent}`,
        message: `A new Yankees ticket request has been submitted.

Game: Yankees vs ${requestModalTicket.opponent}
Date: ${formatDate(requestModalTicket.game_date)}${requestModalTicket.game_time ? ` at ${requestModalTicket.game_time}` : ''}${requestModalTicket.day_of_week ? ` (${requestModalTicket.day_of_week})` : ''}

Requested by: ${requesterName} (${requesterEmail})

Client Name: ${clientName.trim()}
Client Email: ${clientEmail.trim()}

Please log in to Evident Edge to approve or deny this request.`,
        senderEmail: requesterEmail,
      });

      setNotification({ type: 'success', message: 'Request submitted! Mike Carella has been notified.' });
      setRequestModalTicket(null);
      loadMyRequests();
      if (inserted) {
        setActiveTab('my-requests');
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: `Failed to submit request: ${err.message}` });
    } finally {
      setSubmittingRequest(false);
    }
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

  const decideRequest = async (request: TicketRequest, approve: boolean) => {
    if (!user) return;

    const action = approve ? 'approve' : 'deny';
    if (!(await dialog.confirm(`Are you sure you want to ${action} this request?`))) return;

    try {
      const { error: updateError } = await supabase
        .from('yankees_ticket_requests')
        .update({
          status: approve ? 'approved' : 'denied',
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      if (approve && request.ticket_id) {
        const { error: ticketError } = await supabase
          .from('yankees_tickets')
          .update({ is_available: false, updated_at: new Date().toISOString() })
          .eq('id', request.ticket_id);
        if (ticketError) throw ticketError;
      }

      const dateLabel = request.ticket ? formatDate(request.ticket.game_date) : formatDate(request.game_date);
      const opponentLabel = request.ticket?.opponent || '';

      const subject = `Yankees Ticket Request ${approve ? 'Approved' : 'Denied'} - ${dateLabel}`;
      const message = `Your Yankees ticket request has been ${approve ? 'APPROVED' : 'DENIED'}.

Game: Yankees vs ${opponentLabel}
Date: ${dateLabel}
Client: ${request.client_name} (${request.client_email})

${approve ? 'Please coordinate with Mike Carella on next steps.' : 'Please contact Mike Carella if you have questions.'}`;

      const recipients = [{ name: request.requester_name, email: request.requester_email }];
      if (request.requester_email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        recipients.push({ name: SUPER_ADMIN_NAME, email: SUPER_ADMIN_EMAIL });
      }

      await sendNotificationEmail({ to: recipients, subject, message });

      setNotification({ type: 'success', message: `Request ${approve ? 'approved' : 'denied'}` });
      loadAllRequests();
      loadTickets();
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: `Failed to update request: ${err.message}` });
    }
  };

  const toggleAvailability = async (ticket: YankeesTicket) => {
    try {
      const { error } = await supabase
        .from('yankees_tickets')
        .update({ is_available: !ticket.is_available, updated_at: new Date().toISOString() })
        .eq('id', ticket.id);

      if (error) throw error;
      loadTickets();
    } catch (err: any) {
      setNotification({ type: 'error', message: `Failed: ${err.message}` });
    }
  };

  const deleteTicket = async (ticket: YankeesTicket) => {
    if (!(await dialog.confirm(`Delete game on ${formatDate(ticket.game_date)} vs ${ticket.opponent}?`))) return;
    try {
      const { error } = await supabase.from('yankees_tickets').delete().eq('id', ticket.id);
      if (error) throw error;
      loadTickets();
    } catch (err: any) {
      setNotification({ type: 'error', message: `Failed: ${err.message}` });
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingTickets = tickets.filter((t) => t.game_date >= today);

  const pendingCount = allRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto">
      {notification && (
        <Toast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Yankees Tickets</h2>
              <p className="text-sm text-slate-300 mt-0.5">Request game tickets for clients</p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 px-4">
          <div className="flex gap-1 overflow-x-auto">
            <TabButton active={activeTab === 'available'} onClick={() => setActiveTab('available')} icon={Calendar} label="Available Games" />
            <TabButton active={activeTab === 'my-requests'} onClick={() => setActiveTab('my-requests')} icon={Clock} label="My Requests" badge={myRequests.filter(r => r.status === 'pending').length} />
            {isSuperAdmin && (
              <>
                <TabButton active={activeTab === 'admin-requests'} onClick={() => setActiveTab('admin-requests')} icon={AlertCircle} label="Manage Requests" badge={pendingCount} badgeColor="bg-red-500" />
                <TabButton active={activeTab === 'admin-upload'} onClick={() => setActiveTab('admin-upload')} icon={Upload} label="Upload Schedule" />
              </>
            )}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'available' && (
            <AvailableGamesList
              tickets={upcomingTickets}
              loading={loading}
              isSuperAdmin={isSuperAdmin}
              onRequest={openRequestModal}
              onToggleAvailability={toggleAvailability}
              onDelete={deleteTicket}
              formatDate={formatDate}
            />
          )}

          {activeTab === 'my-requests' && (
            <MyRequestsList requests={myRequests} formatDate={formatDate} />
          )}

          {activeTab === 'admin-requests' && isSuperAdmin && (
            <AdminRequestsList
              requests={allRequests}
              formatDate={formatDate}
              onDecide={decideRequest}
            />
          )}

          {activeTab === 'admin-upload' && isSuperAdmin && (
            <UploadSchedule
              uploadFile={uploadFile}
              uploadPreview={uploadPreview}
              uploadYear={uploadYear}
              uploading={uploading}
              onFileSelect={handleFileSelect}
              onYearChange={setUploadYear}
              onConfirm={handleConfirmUpload}
              onClear={() => { setUploadFile(null); setUploadPreview([]); }}
              formatDate={formatDate}
            />
          )}
        </div>
      </div>

      {requestModalTicket && (
        <RequestModal
          ticket={requestModalTicket}
          clientName={clientName}
          clientEmail={clientEmail}
          submitting={submittingRequest}
          onClientNameChange={setClientName}
          onClientEmailChange={setClientEmail}
          onSubmit={submitRequest}
          onClose={() => setRequestModalTicket(null)}
          formatDate={formatDate}
        />
      )}
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
        active ? 'text-blue-700 border-b-2 border-blue-700' : 'text-slate-600 hover:text-slate-900'
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

function AvailableGamesList({ tickets, loading, isSuperAdmin, onRequest, onToggleAvailability, onDelete, formatDate }: any) {
  if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>;
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500">No upcoming games available</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {tickets.map((ticket: YankeesTicket) => (
        <div
          key={ticket.id}
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border transition-all ${
            ticket.is_available
              ? 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
              : 'border-slate-200 bg-slate-50 opacity-70'
          }`}
        >
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={`p-3 rounded-lg ${ticket.is_available ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900">
                Yankees vs {ticket.opponent}
              </div>
              <div className="text-sm text-slate-600 mt-0.5">
                {formatDate(ticket.game_date)}
                {ticket.game_time && <span> · {ticket.game_time}</span>}
                {ticket.day_of_week && <span className="text-slate-400"> · {ticket.day_of_week}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              ticket.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
            }`}>
              {ticket.is_available ? 'Available' : 'Unavailable'}
            </span>
            {ticket.is_available && (
              <button
                onClick={() => onRequest(ticket)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-4 h-4" />
                Request
              </button>
            )}
            {isSuperAdmin && (
              <>
                <button
                  onClick={() => onToggleAvailability(ticket)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {ticket.is_available ? 'Mark Unavailable' : 'Mark Available'}
                </button>
                <button
                  onClick={() => onDelete(ticket)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MyRequestsList({ requests, formatDate }: { requests: TicketRequest[]; formatDate: (s: string) => string }) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500">You have no ticket requests yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <div key={req.id} className="p-4 border border-slate-200 rounded-lg">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900">
                Yankees vs {req.ticket?.opponent || '—'}
              </div>
              <div className="text-sm text-slate-600 mt-1">{formatDate(req.game_date)}</div>
              <div className="text-sm text-slate-700 mt-2">
                <span className="font-medium">Client:</span> {req.client_name} · {req.client_email}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Submitted {new Date(req.created_at).toLocaleString()}
              </div>
            </div>
            <StatusBadge status={req.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminRequestsList({ requests, formatDate, onDecide }: {
  requests: TicketRequest[]; formatDate: (s: string) => string; onDecide: (r: TicketRequest, a: boolean) => void;
}) {
  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Pending ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="text-slate-500 text-sm py-6 text-center bg-slate-50 rounded-lg">No pending requests</p>
        ) : (
          <div className="space-y-3">
            {pending.map((req) => (
              <div key={req.id} className="p-4 border-2 border-amber-200 bg-amber-50 rounded-lg">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900">
                      Yankees vs {req.ticket?.opponent || '—'} · {formatDate(req.game_date)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-sm">
                      <div><span className="font-medium text-slate-700">Requester:</span> {req.requester_name}</div>
                      <div><span className="font-medium text-slate-700">Requester Email:</span> {req.requester_email}</div>
                      <div><span className="font-medium text-slate-700">Client:</span> {req.client_name}</div>
                      <div><span className="font-medium text-slate-700">Client Email:</span> {req.client_email}</div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Submitted {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDecide(req, true)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => onDecide(req, false)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" /> Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Decided ({decided.length})</h3>
        {decided.length === 0 ? (
          <p className="text-slate-500 text-sm py-6 text-center bg-slate-50 rounded-lg">No decided requests</p>
        ) : (
          <div className="space-y-2">
            {decided.map((req) => (
              <div key={req.id} className="p-3 border border-slate-200 rounded-lg flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-semibold text-slate-900">
                    Yankees vs {req.ticket?.opponent || '—'} · {formatDate(req.game_date)}
                  </div>
                  <div className="text-slate-600 mt-1">
                    {req.requester_name} requested for {req.client_name} ({req.client_email})
                  </div>
                  {req.decided_at && (
                    <div className="text-xs text-slate-500 mt-1">Decided {new Date(req.decided_at).toLocaleString()}</div>
                  )}
                </div>
                <StatusBadge status={req.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UploadSchedule({ uploadFile, uploadPreview, uploadYear, uploading, onFileSelect, onYearChange, onConfirm, onClear, formatDate }: any) {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <div className="font-semibold mb-1">Upload Yankees Schedule</div>
        <p>Upload an Excel or CSV file with columns: <code className="bg-blue-100 px-1.5 py-0.5 rounded">Date</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">Time</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">Day</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">Opponent</code>. Uploading replaces all tickets for the selected season year.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Season Year</label>
          <input
            type="number"
            value={uploadYear}
            onChange={(e) => onYearChange(parseInt(e.target.value) || new Date().getFullYear())}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Schedule File</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
            className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
          />
        </div>
      </div>

      {uploadFile && uploadPreview.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Preview: {uploadPreview.length} games</div>
            <button onClick={onClear} className="text-sm text-slate-600 hover:text-slate-900">Clear</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Time</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Day</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Opponent</th>
                </tr>
              </thead>
              <tbody>
                {uploadPreview.map((row: any, idx: number) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{formatDate(row.game_date)}</td>
                    <td className="px-3 py-2 text-slate-600">{row.game_time}</td>
                    <td className="px-3 py-2 text-slate-600">{row.day_of_week}</td>
                    <td className="px-3 py-2 text-slate-900 font-medium">{row.opponent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
            <button onClick={onClear} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">Cancel</button>
            <button
              onClick={onConfirm}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : `Replace ${uploadYear} Schedule`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestModal({ ticket, clientName, clientEmail, submitting, onClientNameChange, onClientEmailChange, onSubmit, onClose, formatDate }: any) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Request Tickets</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="font-semibold text-slate-900">Yankees vs {ticket.opponent}</div>
            <div className="text-sm text-slate-700">
              {formatDate(ticket.game_date)}
              {ticket.game_time && ` · ${ticket.game_time}`}
              {ticket.day_of_week && ` · ${ticket.day_of_week}`}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Client Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => onClientNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter client's full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Client Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => onClientEmailChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="client@example.com"
              required
            />
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
            Your request will be sent to Mike Carella for approval. You will be notified when a decision is made.
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
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
