import { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw, Search, Filter, X, CreditCard as Edit2, Trash2, Upload, DollarSign, FileArchive, Eye, Image, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { formatDateForDisplay, formatTimestampForDisplay, getTodayDateString, getESTToday, formatDateWithWeekday, formatDateShort } from '../lib/dateUtils';
import { convertToJpeg, isImageFile } from '../lib/imageUtils';

interface MeetingReceipt {
  id: string;
  file_path: string;
  file_name: string | null;
  created_at: string;
}

interface MeetingLog {
  id: string;
  meeting_date: string;
  notes: string;
  created_at: string;
  salesperson_id: string;
  is_meeting?: boolean;
  is_text?: boolean;
  is_call?: boolean;
  is_email?: boolean;
  has_expense?: boolean;
  expense_payment_method?: string;
  expense_amount?: number;
  receipt_url?: string;
  receipts?: MeetingReceipt[];
  meeting_group_id?: string | null;
  is_primary_for_expense?: boolean;
  contact: {
    name: string;
    type: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
  salesperson: {
    name: string;
    email: string;
  };
}

interface SalesPerson {
  id: string;
  name: string;
}

export function MeetingLogsReport() {
  const { salesPerson, isAdmin } = useAuth();
  const [meetings, setMeetings] = useState<MeetingLog[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [editingMeeting, setEditingMeeting] = useState<MeetingLog | null>(null);
  const [editFormData, setEditFormData] = useState({
    meeting_date: '',
    notes: '',
    is_meeting: false,
    is_text: false,
    is_call: false,
    is_email: false,
    has_expense: false,
    expense_payment_method: '',
    expense_amount: '',
    receipt_files: [] as File[],
  });
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [previewReceiptFilename, setPreviewReceiptFilename] = useState<string | null>(null);
  const [previewMeetingInfo, setPreviewMeetingInfo] = useState<{ contactName: string; date: string } | null>(null);
  const [expandedSalespeople, setExpandedSalespeople] = useState<Set<string>>(new Set());

  const closePreviewModal = () => {
    if (previewReceiptUrl) {
      URL.revokeObjectURL(previewReceiptUrl);
    }
    setPreviewReceiptUrl(null);
    setPreviewReceiptFilename(null);
    setPreviewMeetingInfo(null);
  };

  useEffect(() => {
    if (isAdmin) {
      loadSalesPeople();
    }
    const today = getESTToday();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const year = thirtyDaysAgo.getFullYear();
    const month = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
    const day = String(thirtyDaysAgo.getDate()).padStart(2, '0');
    setStartDate(`${year}-${month}-${day}`);
    setEndDate(getTodayDateString());
  }, [isAdmin]);

  useEffect(() => {
    if (startDate && endDate) {
      loadMeetings();
    }
  }, [startDate, endDate, selectedSalesperson]);

  const loadSalesPeople = async () => {
    const { data } = await supabase
      .from('sales_people')
      .select('id, name')
      .order('name');
    setSalesPeople(data || []);
  };

  const loadMeetings = async () => {
    if (!salesPerson) return;

    setLoading(true);
    try {
      let query = supabase
        .from('meetings')
        .select(`
          id,
          meeting_date,
          notes,
          created_at,
          salesperson_id,
          is_meeting,
          is_text,
          is_call,
          is_email,
          has_expense,
          expense_payment_method,
          expense_amount,
          receipt_url,
          receipts:meeting_receipts(id, file_path, file_name, created_at),
          meeting_group_id,
          is_primary_for_expense,
          contact:contacts(name, type, company, email, phone),
          salesperson:sales_people!meetings_salesperson_id_fkey(name, email)
        `)
        .gte('meeting_date', startDate)
        .lte('meeting_date', endDate)
        .order('meeting_date', { ascending: false });

      // Non-admin users can only see their own meetings
      if (!isAdmin) {
        query = query.eq('salesperson_id', salesPerson.id);
      } else if (selectedSalesperson) {
        // Admins can filter by specific salesperson
        query = query.eq('salesperson_id', selectedSalesperson);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading meetings:', error);
        alert('Failed to load meetings');
        return;
      }

      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
      alert('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const canEditMeeting = (meeting: MeetingLog) => {
    if (!salesPerson) return false;
    return isAdmin || meeting.salesperson_id === salesPerson.id;
  };

  const handleEditClick = (meeting: MeetingLog) => {
    setEditingMeeting(meeting);
    setEditFormData({
      meeting_date: meeting.meeting_date,
      notes: meeting.notes,
      is_meeting: meeting.is_meeting || false,
      is_text: meeting.is_text || false,
      is_call: meeting.is_call || false,
      is_email: meeting.is_email || false,
      has_expense: meeting.has_expense || false,
      expense_payment_method: meeting.expense_payment_method || '',
      expense_amount: meeting.expense_amount ? meeting.expense_amount.toString() : '',
      receipt_files: [],
    });
  };

  const handleEditSave = async () => {
    if (!editingMeeting || !salesPerson) return;
    if (editFormData.has_expense && !editFormData.expense_payment_method) return;

    try {
      let receiptUrl = editingMeeting.receipt_url || null;
      const uploadedReceipts: { filePath: string; fileName: string }[] = [];

      if (editFormData.receipt_files.length > 0) {
        for (const receiptFile of editFormData.receipt_files) {
          let fileToUpload = receiptFile;
          const fileExtension = '.' + receiptFile.name.split('.').pop()?.toLowerCase();
          const isImage = receiptFile.type.startsWith('image/');

          if (isImage) {
            if (isImageFile(receiptFile)) {
              try {
                fileToUpload = await convertToJpeg(receiptFile);
              } catch (error) {
                console.error('Failed to convert image to JPEG:', error);
                throw error instanceof Error ? error : new Error('Failed to process receipt image. Please try again.');
              }
            } else {
              throw new Error(`RAW image format ${fileExtension.toUpperCase()} is not supported. Please convert to JPG, PNG, or another standard format first.`);
            }
          }

          const fileName = `${salesPerson.user_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpeg`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(filePath, fileToUpload);

          if (uploadError) throw uploadError;
          uploadedReceipts.push({ filePath, fileName: receiptFile.name });
        }

        if (!receiptUrl && uploadedReceipts.length > 0) {
          receiptUrl = uploadedReceipts[0].filePath;
        }
      }

      const { error } = await supabase
        .from('meetings')
        .update({
          meeting_date: editFormData.meeting_date,
          notes: editFormData.notes,
          is_meeting: editFormData.is_meeting,
          is_text: editFormData.is_text,
          is_call: editFormData.is_call,
          is_email: editFormData.is_email,
          has_expense: editFormData.has_expense,
          expense_payment_method: editFormData.has_expense ? editFormData.expense_payment_method : null,
          expense_amount: editFormData.has_expense && editFormData.expense_amount ? parseFloat(editFormData.expense_amount) : null,
          receipt_url: editFormData.has_expense ? receiptUrl : null,
        })
        .eq('id', editingMeeting.id);

      if (error) {
        console.error('Error updating meeting:', error);
        alert('Failed to update meeting');
        return;
      }

      if (uploadedReceipts.length > 0 && editFormData.has_expense) {
        const receiptsToInsert = uploadedReceipts.map(receipt => ({
          meeting_id: editingMeeting.id,
          file_path: receipt.filePath,
          file_name: receipt.fileName,
          created_by: salesPerson.user_id,
        }));

        const { error: receiptsError } = await supabase
          .from('meeting_receipts')
          .insert(receiptsToInsert);

        if (receiptsError) {
          console.error('Error saving receipt records:', receiptsError);
        }
      }

      setEditingMeeting(null);
      loadMeetings();
    } catch (error) {
      console.error('Error updating meeting:', error);
      alert('Failed to update meeting');
    }
  };

  const handleDeleteClick = async (meeting: MeetingLog) => {
    if (!confirm(`Are you sure you want to delete this meeting with ${meeting.contact.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meeting.id);

      if (error) {
        console.error('Error deleting meeting:', error);
        alert('Failed to delete meeting');
        return;
      }

      loadMeetings();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Failed to delete meeting');
    }
  };

  const handleViewReceipt = async (meeting: MeetingLog, receiptPath?: string) => {
    const pathToDownload = receiptPath || meeting.receipt_url;
    if (!pathToDownload) return;

    try {
      const { data: fileData, error } = await supabase.storage
        .from('receipts')
        .download(pathToDownload);

      if (error) {
        console.error('Error downloading receipt:', error);
        alert('Failed to load receipt. Please try again.');
        return;
      }

      if (fileData) {
        if (previewReceiptUrl) {
          URL.revokeObjectURL(previewReceiptUrl);
        }

        const blobUrl = URL.createObjectURL(fileData);
        const filename = pathToDownload.split('/').pop() || 'receipt';
        setPreviewReceiptUrl(blobUrl);
        setPreviewReceiptFilename(filename);
        setPreviewMeetingInfo({
          contactName: meeting.contact.name,
          date: formatDateWithWeekday(meeting.meeting_date),
        });
      }
    } catch (error) {
      console.error('Error loading receipt:', error);
      alert('Failed to load receipt. Please try again.');
    }
  };

  const filteredMeetings = meetings.filter((meeting) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      meeting.contact.name.toLowerCase().includes(query) ||
      meeting.salesperson.name.toLowerCase().includes(query) ||
      meeting.notes.toLowerCase().includes(query) ||
      meeting.contact.company?.toLowerCase().includes(query) ||
      meeting.contact.type.toLowerCase().includes(query)
    );
  });

  const exportToExcel = () => {
    if (filteredMeetings.length === 0) {
      alert('No meetings to export');
      return;
    }

    // Sort meetings by salesperson name, then by date (most recent first)
    const sortedMeetings = [...filteredMeetings].sort((a, b) => {
      const nameComparison = a.salesperson.name.localeCompare(b.salesperson.name);
      if (nameComparison !== 0) return nameComparison;
      return new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime();
    });

    const worksheetData = sortedMeetings.map((meeting) => {
      const meetingTypes = [];
      if (meeting.is_meeting) meetingTypes.push('Meeting');
      if (meeting.is_text) meetingTypes.push('Text');
      if (meeting.is_call) meetingTypes.push('Call');
      if (meeting.is_email) meetingTypes.push('Email');

      // Only show expense data for primary meetings (to avoid duplicates in grouped meetings)
      const showExpense = meeting.is_primary_for_expense !== false;

      return {
        'Meeting Date': formatDateShort(meeting.meeting_date),
        'Interaction Type': meetingTypes.join(', ') || 'Not specified',
        'Has Expense': showExpense && meeting.has_expense ? 'Yes' : 'No',
        'Payment Method': showExpense && meeting.expense_payment_method ? (meeting.expense_payment_method === 'personal' ? 'Personal' : 'Company') : '',
        'Expense Amount': showExpense && meeting.expense_amount ? parseFloat(meeting.expense_amount.toString()) : '',
        'Receipt Included': showExpense && meeting.receipt_url ? 'Yes' : 'No',
        'Salesperson': meeting.salesperson.name,
        'Contact Name': meeting.contact.name,
        'Contact Type': meeting.contact.type,
        'Contact Company': meeting.contact.company || '',
        'Contact Email': meeting.contact.email || '',
        'Contact Phone': meeting.contact.phone || '',
        'Meeting Notes': meeting.notes,
        'Logged On': formatTimestampForDisplay(meeting.created_at),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Meeting Logs');

    const filename = `meeting_logs_${startDate}_to_${endDate}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const exportReceipts = async () => {
    const meetingsWithReceipts = filteredMeetings.filter(m =>
      m.is_primary_for_expense !== false &&
      ((m.receipts && m.receipts.length > 0) || m.receipt_url)
    );

    if (meetingsWithReceipts.length === 0) {
      alert('No receipts found in the selected date range');
      return;
    }

    try {
      const zip = new JSZip();
      let successCount = 0;
      let failCount = 0;
      const usedFilenames = new Map<string, number>();

      for (const meeting of meetingsWithReceipts) {
        const receiptsToDownload: { path: string; index: number }[] = [];

        if (meeting.receipts && meeting.receipts.length > 0) {
          meeting.receipts.forEach((r, idx) => {
            receiptsToDownload.push({ path: r.file_path, index: idx + 1 });
          });
        } else if (meeting.receipt_url) {
          receiptsToDownload.push({ path: meeting.receipt_url, index: 1 });
        }

        for (const receipt of receiptsToDownload) {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('receipts')
              .download(receipt.path);

            if (downloadError) {
              throw downloadError;
            }

            if (fileData) {
              const fileExtension = receipt.path.split('.').pop() || 'jpg';
              const meetingDate = new Date(meeting.meeting_date);
              const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
              const day = String(meetingDate.getDate()).padStart(2, '0');
              const year = meetingDate.getFullYear();
              const receiptSuffix = receiptsToDownload.length > 1 ? `_receipt${receipt.index}` : '';
              const baseFileName = `${month}-${day}-${year}_${meeting.salesperson.name.replace(/\s+/g, '_')}_${meeting.contact.name.replace(/\s+/g, '_')}${receiptSuffix}`;

              const count = usedFilenames.get(baseFileName) || 0;
              usedFilenames.set(baseFileName, count + 1);
              const uniqueSuffix = count > 0 ? `_${count + 1}` : '';
              const fileName = `${baseFileName}${uniqueSuffix}.${fileExtension}`;

              zip.file(fileName, fileData);
              successCount++;
            }
          } catch (error) {
            console.error(`Failed to download receipt for meeting ${meeting.id}:`, error);
            failCount++;
          }
        }
      }

      if (successCount === 0) {
        alert('Failed to download any receipts. Please try again.');
        return;
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipts_${startDate}_to_${endDate}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (failCount > 0) {
        alert(`Successfully downloaded ${successCount} receipt(s). ${failCount} receipt(s) failed to download.`);
      } else {
        alert(`Successfully downloaded ${successCount} receipt(s).`);
      }
    } catch (error) {
      console.error('Error exporting receipts:', error);
      alert('Failed to export receipts. Please try again.');
    }
  };

  const clearFilters = () => {
    if (isAdmin) {
      setSelectedSalesperson('');
    }
    setSearchQuery('');
    const today = getESTToday();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const year = thirtyDaysAgo.getFullYear();
    const month = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
    const day = String(thirtyDaysAgo.getDate()).padStart(2, '0');
    setStartDate(`${year}-${month}-${day}`);
    setEndDate(getTodayDateString());
  };

  const groupedMeetings = filteredMeetings.reduce((acc, meeting) => {
    const salespersonName = meeting.salesperson.name;
    if (!acc[salespersonName]) {
      acc[salespersonName] = [];
    }
    acc[salespersonName].push(meeting);
    return acc;
  }, {} as Record<string, MeetingLog[]>);

  const toggleSalesperson = (name: string) => {
    setExpandedSalespeople(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSalespeople(new Set(Object.keys(groupedMeetings)));
  };

  const collapseAll = () => {
    setExpandedSalespeople(new Set());
  };

  const salespersonCount = Object.keys(groupedMeetings).length;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-slate-900 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Meeting Logs Report</h2>
              <p className="text-sm text-slate-600 mt-1">
                Track salesperson meeting activities and notes
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
            {isAdmin && (
              <button
                onClick={exportReceipts}
                disabled={filteredMeetings.filter(m => m.is_primary_for_expense !== false && ((m.receipts && m.receipts.length > 0) || m.receipt_url)).length === 0}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Export all receipts as ZIP (excluding duplicates from grouped meetings)"
              >
                <FileArchive className="w-4 h-4" />
                Export Receipts
              </button>
            )}
            <button
              onClick={exportToExcel}
              disabled={filteredMeetings.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
            <button
              onClick={loadMeetings}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Salesperson
                </label>
                <select
                  value={selectedSalesperson}
                  onChange={(e) => setSelectedSalesperson(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Salespeople</option>
                  {salesPeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Contact, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Found {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
              {isAdmin && selectedSalesperson && ` for selected salesperson`}
            </p>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-semibold text-slate-900 mb-2">No Meetings Found</p>
            <p className="text-slate-600">
              {startDate && endDate
                ? 'No meetings were logged during the selected period.'
                : 'Select a date range to view meeting logs.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {isAdmin && salespersonCount > 1 && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-sm text-slate-600">
                  {salespersonCount} salesperson{salespersonCount !== 1 ? 's' : ''} with meetings
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Expand All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={collapseAll}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Collapse All
                  </button>
                </div>
              </div>
            )}
            {Object.entries(groupedMeetings)
              .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
              .map(([salespersonName, salespersonMeetings]) => {
                const isExpanded = !isAdmin || expandedSalespeople.has(salespersonName);
                return (
              <div key={salespersonName} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => isAdmin && toggleSalesperson(salespersonName)}
                  className={`w-full bg-blue-50 px-4 py-3 border-b border-slate-200 ${isAdmin ? 'cursor-pointer hover:bg-blue-100 transition-colors' : ''}`}
                  disabled={!isAdmin}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-500" />
                        )
                      )}
                      <h3 className="font-semibold text-slate-900 text-lg">{salespersonName}</h3>
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      {salespersonMeetings.length} meeting{salespersonMeetings.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                <div className="divide-y divide-slate-200">
                  {salespersonMeetings.map((meeting) => (
                    <div key={meeting.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg font-semibold text-slate-900">
                              {meeting.contact.name}
                            </span>
                            <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded capitalize">
                              {meeting.contact.type}
                            </span>
                          </div>
                          {meeting.contact.company && (
                            <p className="text-sm text-slate-600 mb-1">{meeting.contact.company}</p>
                          )}
                          <div className="flex gap-4 text-sm text-slate-500">
                            {meeting.contact.email && <span>{meeting.contact.email}</span>}
                            {meeting.contact.phone && <span>{meeting.contact.phone}</span>}
                          </div>
                          <div className="flex gap-2 flex-wrap mt-2">
                            {meeting.is_meeting && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                Meeting
                              </span>
                            )}
                            {meeting.is_text && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                Text
                              </span>
                            )}
                            {meeting.is_call && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                Call
                              </span>
                            )}
                            {meeting.is_email && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                Email
                              </span>
                            )}
                            {meeting.has_expense && meeting.is_primary_for_expense !== false && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                                Expense{meeting.expense_payment_method ? ` (${meeting.expense_payment_method === 'personal' ? 'Personal' : 'Company'})` : ''}
                              </span>
                            )}
                            {meeting.has_expense && meeting.is_primary_for_expense === false && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                                Expense (See Primary)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-start gap-2 mb-2">
                            {canEditMeeting(meeting) && (
                              <>
                                <button
                                  onClick={() => handleEditClick(meeting)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit meeting"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(meeting)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete meeting"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-900 mb-1">
                            {formatDateWithWeekday(meeting.meeting_date)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Logged: {formatTimestampForDisplay(meeting.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <p className="text-sm font-medium text-slate-700 mb-1">Meeting Notes:</p>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{meeting.notes}</p>
                      </div>
                      {meeting.has_expense && meeting.is_primary_for_expense !== false && (
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 mt-3">
                          <p className="text-sm font-semibold text-yellow-900 mb-2">Expense Details:</p>
                          <div className="flex items-center gap-4 flex-wrap">
                            {meeting.expense_amount ? (
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-5 h-5 text-yellow-700" />
                                <span className="font-bold text-yellow-900 text-lg">
                                  ${parseFloat(meeting.expense_amount.toString()).toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-yellow-700">Amount not specified</span>
                            )}
                            {meeting.receipts && meeting.receipts.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {meeting.receipts.map((receipt, index) => (
                                  <button
                                    key={receipt.id}
                                    onClick={() => handleViewReceipt(meeting, receipt.file_path)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium text-sm"
                                  >
                                    <Eye className="w-4 h-4" />
                                    Receipt {index + 1}
                                  </button>
                                ))}
                              </div>
                            ) : meeting.receipt_url ? (
                              <button
                                onClick={() => handleViewReceipt(meeting)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium text-sm"
                              >
                                <Eye className="w-4 h-4" />
                                View Receipt
                              </button>
                            ) : (
                              <span className="text-sm text-yellow-700 italic">No receipt uploaded</span>
                            )}
                          </div>
                        </div>
                      )}
                      {meeting.has_expense && meeting.is_primary_for_expense === false && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-3">
                          <p className="text-sm text-slate-600 italic">
                            Expense details shown on primary contact entry to avoid duplication
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>

      {editingMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Edit Meeting</h3>
              <p className="text-sm text-slate-600 mt-1">
                Update meeting with {editingMeeting.contact.name}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Meeting Date
                </label>
                <input
                  type="date"
                  value={editFormData.meeting_date}
                  onChange={(e) => setEditFormData({ ...editFormData, meeting_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Interaction Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={editFormData.is_meeting}
                      onChange={(e) => setEditFormData({ ...editFormData, is_meeting: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Meeting</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={editFormData.is_text}
                      onChange={(e) => setEditFormData({ ...editFormData, is_text: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Text</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={editFormData.is_call}
                      onChange={(e) => setEditFormData({ ...editFormData, is_call: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Call</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={editFormData.is_email}
                      onChange={(e) => setEditFormData({ ...editFormData, is_email: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Email</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Meeting Notes
                </label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter meeting notes..."
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg hover:bg-yellow-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={editFormData.has_expense}
                    onChange={(e) => {
                      setEditFormData({
                        ...editFormData,
                        has_expense: e.target.checked,
                        expense_payment_method: e.target.checked ? editFormData.expense_payment_method : ''
                      });
                    }}
                    className="w-5 h-5 text-yellow-600 border-yellow-400 rounded focus:ring-yellow-500"
                  />
                  <span className="text-base font-bold text-slate-800">This meeting had an expense</span>
                </label>
                {editFormData.has_expense && (
                  <div className={`mt-3 p-4 bg-white border-2 rounded-lg ${!editFormData.expense_payment_method ? 'border-red-400' : 'border-yellow-300'}`}>
                    <p className="text-sm font-semibold text-slate-700 mb-3">
                      Payment Method: <span className="text-red-500">*</span>
                    </p>
                    {!editFormData.expense_payment_method && (
                      <p className="text-xs text-red-500 mb-2">Please select a payment method</p>
                    )}
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="edit-payment-method"
                          value="personal"
                          checked={editFormData.expense_payment_method === 'personal'}
                          onChange={(e) => setEditFormData({ ...editFormData, expense_payment_method: e.target.value })}
                          className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                        />
                        <span className="text-sm text-slate-700">Personal Credit Card</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="edit-payment-method"
                          value="company"
                          checked={editFormData.expense_payment_method === 'company'}
                          onChange={(e) => setEditFormData({ ...editFormData, expense_payment_method: e.target.value })}
                          className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                        />
                        <span className="text-sm text-slate-700">Company Credit Card</span>
                      </label>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          <DollarSign className="w-4 h-4 inline mr-1" />
                          Expense Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editFormData.expense_amount}
                          onChange={(e) => setEditFormData({ ...editFormData, expense_amount: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          <Upload className="w-4 h-4 inline mr-1" />
                          Add More Receipts
                        </label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                              setEditFormData(prev => ({
                                ...prev,
                                receipt_files: [...prev.receipt_files, ...Array.from(files)]
                              }));
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                        />
                        {editFormData.receipt_files.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-slate-600 font-medium">{editFormData.receipt_files.length} new file(s) to upload:</p>
                            {editFormData.receipt_files.map((file, index) => (
                              <div key={index} className="flex items-center justify-between bg-yellow-50 px-2 py-1 rounded text-sm">
                                <span className="flex items-center gap-1 text-slate-700 truncate">
                                  <Image className="w-3 h-3 flex-shrink-0" />
                                  {file.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditFormData(prev => ({
                                    ...prev,
                                    receipt_files: prev.receipt_files.filter((_, i) => i !== index)
                                  }))}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setEditingMeeting(null)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editFormData.has_expense && !editFormData.expense_payment_method}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {previewReceiptUrl && previewMeetingInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-yellow-50 to-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Receipt Preview</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {previewMeetingInfo.contactName} - {previewMeetingInfo.date}
                </p>
              </div>
              <button
                onClick={closePreviewModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-100 p-4">
              {previewReceiptUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewReceiptUrl}
                  className="w-full h-full border-0 rounded-lg bg-white"
                  title="Receipt Preview"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <img
                    src={previewReceiptUrl}
                    alt="Receipt"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
              <a
                href={previewReceiptUrl}
                download={previewReceiptFilename || 'receipt'}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                Download Receipt
              </a>
              <button
                onClick={closePreviewModal}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
