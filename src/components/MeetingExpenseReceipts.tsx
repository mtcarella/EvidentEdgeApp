import { useState, useEffect } from 'react';
import {
  Download, Trash2, Pencil, Upload, StickyNote, FileText, FileSpreadsheet,
  Image as ImageIcon, File as FileIcon, DollarSign, Check, X, Loader,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDialog } from '../contexts/DialogContext';
import { adjustBudget, getBudgetTypeForContact } from '../lib/budgetUtils';
import { formatTimestampForDisplay } from '../lib/dateUtils';
import { formatFileSize, buildReceiptFilename } from './ExpenseListEditor';

export interface MeetingExpense {
  id: string;
  description: string | null;
  amount: number | null;
  category: string | null;
  notes: string | null;
  receipt_path: string | null;
  receipt_name: string | null;
  receipt_original_name: string | null;
  receipt_size: number | null;
  receipt_type: string | null;
  receipt_uploaded_at: string | null;
  created_at: string;
  created_by: string | null;
}

type FileKind = 'image' | 'pdf' | 'excel' | 'word' | 'other';

function getFileKind(name: string | null, mime: string | null): FileKind {
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';
  const type = (mime || '').toLowerCase();
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'image';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (type.includes('spreadsheet') || type.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
  if (type.includes('word') || type.includes('msword') || ['doc', 'docx'].includes(ext)) return 'word';
  return 'other';
}

function FileKindIcon({ kind }: { kind: FileKind }) {
  switch (kind) {
    case 'pdf':
      return <FileText className="w-5 h-5 text-red-500" />;
    case 'excel':
      return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    case 'word':
      return <FileText className="w-5 h-5 text-blue-600" />;
    case 'image':
      return <ImageIcon className="w-5 h-5 text-slate-500" />;
    default:
      return <FileIcon className="w-5 h-5 text-slate-400" />;
  }
}

interface MeetingExpenseReceiptsProps {
  meetingId: string;
  meetingDate: string;
  meetingExpenseAmount: number | null;
  salespersonId: string;
  contactName: string;
  username?: string;
  expenses: MeetingExpense[];
  canEdit: boolean;
  currentUserId?: string;
  onChanged: () => void;
}

export function MeetingExpenseReceipts({
  meetingId,
  meetingDate,
  meetingExpenseAmount,
  salespersonId,
  contactName,
  username,
  expenses,
  canEdit,
  currentUserId,
  onChanged,
}: MeetingExpenseReceiptsProps) {
  const dialog = useDialog();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [detailsDraft, setDetailsDraft] = useState({ amount: '', category: '', description: '' });
  const [notesId, setNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadThumbs = async () => {
      const next: Record<string, string> = {};
      for (const e of expenses) {
        if (!e.receipt_path) continue;
        if (getFileKind(e.receipt_name || e.receipt_original_name, e.receipt_type) !== 'image') continue;
        const { data } = await supabase.storage.from('receipts').createSignedUrl(e.receipt_path, 300);
        if (data?.signedUrl) next[e.id] = data.signedUrl;
      }
      if (!cancelled) setThumbs(next);
    };
    loadThumbs();
    return () => { cancelled = true; };
  }, [expenses]);

  const budgetType = getBudgetTypeForContact(contactName);

  const syncTotal = async (nextTotal: number) => {
    const oldTotal = meetingExpenseAmount ?? 0;
    await supabase
      .from('meetings')
      .update({ expense_amount: nextTotal > 0 ? nextTotal : null })
      .eq('id', meetingId);
    if (nextTotal !== oldTotal) {
      await adjustBudget(salespersonId, oldTotal, nextTotal, budgetType, meetingId);
    }
  };

  const openReceipt = async (e: MeetingExpense) => {
    if (!e.receipt_path) return;
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(e.receipt_path, 300);
    if (error || !data?.signedUrl) {
      await dialog.alert('Could not open this receipt.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const downloadReceipt = async (e: MeetingExpense) => {
    if (!e.receipt_path) return;
    setBusyId(e.id);
    try {
      const { data, error } = await supabase.storage.from('receipts').download(e.receipt_path);
      if (error || !data) {
        await dialog.alert('Failed to download receipt.');
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = e.receipt_name || e.receipt_original_name || 'receipt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusyId(null);
    }
  };

  const deleteExpense = async (e: MeetingExpense) => {
    setBusyId(e.id);
    try {
      if (e.receipt_path) {
        await supabase.storage.from('receipts').remove([e.receipt_path]);
      }
      const { error } = await supabase.from('meeting_expenses').delete().eq('id', e.id);
      if (error) {
        await dialog.alert('Failed to delete receipt.');
        return;
      }
      const nextTotal = expenses
        .filter((x) => x.id !== e.id)
        .reduce((sum, x) => sum + (x.amount ?? 0), 0);
      await syncTotal(nextTotal);
      onChanged();
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  const startEditDetails = (e: MeetingExpense) => {
    setNotesId(null);
    setDetailsId(e.id);
    setDetailsDraft({
      amount: e.amount != null ? String(e.amount) : '',
      category: e.category || '',
      description: e.description || '',
    });
  };

  const saveDetails = async (e: MeetingExpense) => {
    const newAmount = parseFloat(detailsDraft.amount);
    if (Number.isNaN(newAmount) || newAmount < 0) {
      await dialog.alert('Enter a valid amount.');
      return;
    }
    setBusyId(e.id);
    try {
      const { error } = await supabase
        .from('meeting_expenses')
        .update({
          amount: newAmount,
          category: detailsDraft.category.trim() || null,
          description: detailsDraft.description.trim() || null,
        })
        .eq('id', e.id);
      if (error) {
        await dialog.alert('Failed to save changes.');
        return;
      }
      const nextTotal = expenses.reduce(
        (sum, x) => sum + (x.id === e.id ? newAmount : x.amount ?? 0),
        0,
      );
      await syncTotal(nextTotal);
      setDetailsId(null);
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const startEditNotes = (e: MeetingExpense) => {
    setDetailsId(null);
    setNotesId(e.id);
    setNotesDraft(e.notes || '');
  };

  const saveNotes = async (e: MeetingExpense) => {
    setBusyId(e.id);
    try {
      const { error } = await supabase
        .from('meeting_expenses')
        .update({ notes: notesDraft.trim() || null })
        .eq('id', e.id);
      if (error) {
        await dialog.alert('Failed to save note.');
        return;
      }
      setNotesId(null);
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const reupload = async (e: MeetingExpense, file: File) => {
    setBusyId(e.id);
    try {
      const renamed = buildReceiptFilename(
        { date: meetingDate, username, contactName, description: e.description },
        file.name,
      );
      const path = `${meetingId}/${crypto.randomUUID()}/${renamed}`;
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) {
        await dialog.alert('Failed to upload the new file.');
        return;
      }
      const { error } = await supabase
        .from('meeting_expenses')
        .update({
          receipt_path: path,
          receipt_name: renamed,
          receipt_original_name: file.name,
          receipt_size: file.size,
          receipt_type: file.type,
          receipt_uploaded_at: new Date().toISOString(),
        })
        .eq('id', e.id);
      if (error) {
        await dialog.alert('Uploaded the file but failed to save its details.');
        return;
      }
      if (e.receipt_path) {
        await supabase.storage.from('receipts').remove([e.receipt_path]);
      }
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  if (expenses.length === 0) {
    return <p className="text-sm text-yellow-700 italic">No receipts uploaded</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-yellow-800">Itemized Receipts</p>
      <ul className="space-y-2">
        {expenses.map((e) => {
          const kind = getFileKind(e.receipt_name || e.receipt_original_name, e.receipt_type);
          const displayName = e.receipt_name || e.receipt_original_name || e.description || 'Receipt';
          const canManage = canEdit && (currentUserId === e.created_by || canEdit);
          const isBusy = busyId === e.id;
          return (
            <li key={e.id} className="rounded-lg border border-yellow-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => e.receipt_path && openReceipt(e)}
                  className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center hover:ring-2 hover:ring-yellow-400 transition"
                  title={e.receipt_path ? 'Open receipt' : 'No file attached'}
                >
                  {thumbs[e.id] ? (
                    <img src={thumbs[e.id]} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <FileKindIcon kind={kind} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {e.receipt_path ? (
                      <button
                        type="button"
                        onClick={() => openReceipt(e)}
                        className="truncate text-sm font-medium text-slate-900 hover:text-yellow-700 hover:underline"
                        title={displayName}
                      >
                        {displayName}
                      </button>
                    ) : (
                      <span className="truncate text-sm font-medium text-slate-500 italic">No file attached</span>
                    )}
                    <span className="flex items-center gap-1 flex-shrink-0 text-sm font-bold text-yellow-900">
                      <DollarSign className="w-3.5 h-3.5" />
                      {(e.amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="uppercase">{kind}</span>
                    {e.receipt_size ? <span>{formatFileSize(e.receipt_size)}</span> : null}
                    {e.receipt_uploaded_at && <span>Uploaded {formatTimestampForDisplay(e.receipt_uploaded_at)}</span>}
                    {e.category && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{e.category}</span>
                    )}
                  </div>
                  {e.description && (
                    <p className="mt-1 text-sm text-slate-700">{e.description}</p>
                  )}
                  {e.notes && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-slate-600">
                      <StickyNote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                      <span className="whitespace-pre-wrap">{e.notes}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-shrink-0 items-center gap-1">
                  {isBusy && <Loader className="w-4 h-4 animate-spin text-slate-400" />}
                  {e.receipt_path && (
                    <button
                      type="button"
                      onClick={() => downloadReceipt(e)}
                      disabled={isBusy}
                      className="p-1.5 text-slate-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEditDetails(e)}
                        disabled={isBusy}
                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                        title="Edit details"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditNotes(e)}
                        disabled={isBusy}
                        className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
                        title={e.notes ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote className="w-4 h-4" />
                      </button>
                      <label
                        className="p-1.5 text-slate-500 hover:text-yellow-700 hover:bg-yellow-50 rounded transition-colors cursor-pointer"
                        title={e.receipt_path ? 'Replace file' : 'Upload file'}
                      >
                        <Upload className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                          className="hidden"
                          disabled={isBusy}
                          onChange={(ev) => {
                            const f = ev.target.files?.[0];
                            if (f) reupload(e, f);
                            ev.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(e.id)}
                        disabled={isBusy}
                        className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {confirmDeleteId === e.id && (
                <div className="mt-2 flex items-center justify-end gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <span className="text-xs text-red-700 mr-auto">Delete this receipt and its expense?</span>
                  <button
                    type="button"
                    onClick={() => deleteExpense(e)}
                    disabled={isBusy}
                    className="text-xs px-2.5 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-xs px-2.5 py-1 bg-white text-slate-600 border border-slate-300 rounded hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {detailsId === e.id && (
                <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={detailsDraft.amount}
                        onChange={(ev) => setDetailsDraft((d) => ({ ...d, amount: ev.target.value }))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                      <input
                        type="text"
                        value={detailsDraft.category}
                        onChange={(ev) => setDetailsDraft((d) => ({ ...d, category: ev.target.value }))}
                        placeholder="e.g. Meals"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                      <input
                        type="text"
                        value={detailsDraft.description}
                        onChange={(ev) => setDetailsDraft((d) => ({ ...d, description: ev.target.value }))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => saveDetails(e)}
                      disabled={isBusy}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailsId(null)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 bg-white text-slate-600 border border-slate-300 rounded hover:bg-slate-50"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {notesId === e.id && (
                <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2">
                  <label className="block text-xs font-medium text-slate-600">Note</label>
                  <textarea
                    value={notesDraft}
                    onChange={(ev) => setNotesDraft(ev.target.value)}
                    rows={2}
                    placeholder="Add a note about this receipt..."
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => saveNotes(e)}
                      disabled={isBusy}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Save Note
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotesId(null)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 bg-white text-slate-600 border border-slate-300 rounded hover:bg-slate-50"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
