import { useState, useEffect, useRef } from 'react';
import { User, Users, Briefcase, Scale, Wrench, CreditCard as Edit2, X, Save, Loader, ArrowUp, ArrowDown, Search, Eye, Download, Mail, CheckSquare, Square, Calendar, Upload, DollarSign, ChevronDown, ChevronUp, Trash2, AlertTriangle, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { useDeviceDetection } from '../lib/deviceDetection';
import { ContactView } from './ContactView';
import { formatContactData } from '../lib/formatters';
import { ContactEditModal } from './ContactEditModal';
import { expandSearchTermWithNicknames } from '../lib/nicknameMapper';
import { formatDateShort, getESTToday, getTodayDateString } from '../lib/dateUtils';
import { convertToJpeg, isImageFile } from '../lib/imageUtils';
import { deductBudget, formatCurrency } from '../lib/budgetUtils';
import * as XLSX from 'xlsx';

interface Contact {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  company?: string;
  branch?: string;
  address?: string;
  birthday?: string;
  client_paralegal_processor?: string;
  evident_paralegal?: string;
  marketing_points?: number;
  driver?: boolean;
  notes?: string;
  processor_notes?: string;
  created_at: string;
}

const typeIcons = {
  buyer: User,
  realtor: Users,
  loan_officer: Briefcase,
  attorney: Scale,
  vendor: Wrench,
};

const typeLabels = {
  buyer: 'Buyer',
  realtor: 'Realtor',
  loan_officer: 'Loan Officer',
  attorney: 'Attorney',
  vendor: 'Vendor',
};

interface MyContactsProps {
  onNavigateToBudgetRequests?: () => void;
}

export function MyContacts({ onNavigateToBudgetRequests }: MyContactsProps) {
  const { salesPerson, isAdminOrProcessor, isAdmin, user } = useAuth();
  const { isMobile } = useDeviceDetection();
  const dialog = useDialog();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [salesPeople, setSalesPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [filterType, setFilterType] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'type' | 'email' | 'phone' | 'company'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingContactId, setViewingContactId] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [quickMeetingContactId, setQuickMeetingContactId] = useState<string | null>(null);
  const [quickMeetingDate, setQuickMeetingDate] = useState(getTodayDateString());
  const [quickMeetingNotes, setQuickMeetingNotes] = useState('');
  const [quickMeetingIsMeeting, setQuickMeetingIsMeeting] = useState(false);
  const [quickMeetingIsText, setQuickMeetingIsText] = useState(false);
  const [quickMeetingIsCall, setQuickMeetingIsCall] = useState(false);
  const [quickMeetingIsEmail, setQuickMeetingIsEmail] = useState(false);
  const [quickMeetingHasExpense, setQuickMeetingHasExpense] = useState<boolean | null>(null);
  const [quickMeetingExpenseMethod, setQuickMeetingExpenseMethod] = useState('');
  const [quickMeetingExpenseAmount, setQuickMeetingExpenseAmount] = useState('');
  const [quickMeetingReceiptFiles, setQuickMeetingReceiptFiles] = useState<File[]>([]);
  const [quickMeetingSaving, setQuickMeetingSaving] = useState(false);
  const [quickMeetingAdditionalContacts, setQuickMeetingAdditionalContacts] = useState<Set<string>>(new Set());
  const [showQuickMeetingAdditionalContacts, setShowQuickMeetingAdditionalContacts] = useState(false);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadContacts();
    loadSalesPeopleList();
  }, [salesPerson]);

  const loadSalesPeopleList = async () => {
    const { data } = await supabase
      .from('sales_people')
      .select('id, name, user_id')
      .order('name');
    setSalesPeople(data || []);
  };

  const loadContacts = async () => {
    if (!salesPerson?.id) return;

    setLoading(true);
    try {
      const { data: sharedAccess } = await supabase
        .from('shared_contact_access')
        .select('salesperson_id')
        .eq('viewer_id', salesPerson.id);

      const accessibleSalespeopleIds = [salesPerson.id];
      if (sharedAccess) {
        accessibleSalespeopleIds.push(...sharedAccess.map(sa => sa.salesperson_id));
      }

      const [assignedResult, globalResult] = await Promise.all([
        supabase
          .from('contacts')
          .select(`
            *,
            assignments!inner (
              salesperson_id
            )
          `)
          .in('assignments.salesperson_id', accessibleSalespeopleIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('contacts')
          .select('*')
          .eq('is_global', true)
          .order('created_at', { ascending: false })
      ]);

      if (assignedResult.error) throw assignedResult.error;
      if (globalResult.error) throw globalResult.error;

      const assignedContacts = assignedResult.data || [];
      const globalContacts = globalResult.data || [];
      const assignedIds = new Set(assignedContacts.map(c => c.id));
      const uniqueGlobalContacts = globalContacts.filter(c => !assignedIds.has(c.id));

      setContacts([...assignedContacts, ...uniqueGlobalContacts]);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleEdit = (contact: Contact) => {
    // Only open the modal, don't set inline editing state
    setEditingContact(contact);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async (contactId: string) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) {
        throw new Error('Contact not found');
      }

      const updateData: any = {
        name: editForm.name ?? contact.name,
        email: editForm.email ?? contact.email ?? null,
        phone: editForm.phone ?? contact.phone ?? null,
        company: editForm.company ?? contact.company ?? null,
        branch: editForm.branch ?? contact.branch ?? null,
        address: editForm.address ?? contact.address ?? null,
        birthday: editForm.birthday ?? contact.birthday ?? null,
        drinks: editForm.drinks ?? contact.drinks ?? false,
        client_type: editForm.client_type ?? contact.client_type ?? 'prospect',
        grade: editForm.grade ?? contact.grade ?? 'C',
        notes: editForm.notes ?? contact.notes ?? null,
        updated_by: user?.id,
      };

      const { error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId);

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      setContacts(prevContacts =>
        prevContacts.map(c =>
          c.id === contactId
            ? { ...c, ...updateData }
            : c
        )
      );

      setEditingId(null);
      setEditForm({});
    } catch (error: any) {
      console.error('Error updating contact:', error);
      await dialog.alert('Failed to update contact: ' + error.message);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleContactSelection = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === sortedContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(sortedContacts.map(c => c.id)));
    }
  };

  const handleEmailList = async () => {
    const selectedEmails = contacts
      .filter(c => selectedContacts.has(c.id) && c.email)
      .map(c => c.email)
      .filter(Boolean);

    if (selectedEmails.length === 0) {
      await dialog.alert('Please select at least one contact with an email address');
      return;
    }

    const isWindows = navigator.platform.toLowerCase().includes('win') ||
      navigator.userAgent.toLowerCase().includes('windows');
    const separator = isWindows ? ';' : ',';
    const encodedEmails = selectedEmails.map(email => encodeURIComponent(email as string)).join(separator);
    window.location.href = `mailto:?bcc=${encodedEmails}`;
  };

  const resetQuickMeetingForm = () => {
    setQuickMeetingContactId(null);
    setQuickMeetingDate(getTodayDateString());
    setQuickMeetingNotes('');
    setQuickMeetingIsMeeting(false);
    setQuickMeetingIsText(false);
    setQuickMeetingIsCall(false);
    setQuickMeetingIsEmail(false);
    setQuickMeetingHasExpense(null);
    setQuickMeetingExpenseMethod('');
    setQuickMeetingExpenseAmount('');
    setQuickMeetingReceiptFiles([]);
    setQuickMeetingAdditionalContacts(new Set());
    setShowQuickMeetingAdditionalContacts(false);
  };

  const handleQuickMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesPerson?.id || !quickMeetingContactId || !quickMeetingNotes.trim() || quickMeetingHasExpense === null) return;
    if (quickMeetingHasExpense && !quickMeetingExpenseMethod) return;

    setQuickMeetingSaving(true);
    try {
      const uploadedReceipts: { filePath: string; fileName: string }[] = [];

      if (quickMeetingReceiptFiles.length > 0) {
        for (const receiptFile of quickMeetingReceiptFiles) {
          let fileToUpload = receiptFile;
          const isImage = receiptFile.type.startsWith('image/');

          if (isImage && isImageFile(receiptFile)) {
            try {
              fileToUpload = await convertToJpeg(receiptFile);
            } catch (error) {
              console.error('Failed to convert image to JPEG:', error);
              throw new Error('Failed to process receipt image. Please try again.');
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
      }

      const contactsToLog = [quickMeetingContactId, ...Array.from(quickMeetingAdditionalContacts)];
      const meetingGroupId = contactsToLog.length > 1 ? crypto.randomUUID() : null;

      const meetingsToInsert = contactsToLog.map((cId, index) => ({
        contact_id: cId,
        salesperson_id: salesPerson.id,
        meeting_date: quickMeetingDate,
        notes: quickMeetingNotes,
        is_meeting: quickMeetingIsMeeting,
        is_text: quickMeetingIsText,
        is_call: quickMeetingIsCall,
        is_email: quickMeetingIsEmail,
        has_expense: quickMeetingHasExpense,
        expense_payment_method: quickMeetingHasExpense ? quickMeetingExpenseMethod : null,
        expense_amount: quickMeetingHasExpense && quickMeetingExpenseAmount ? parseFloat(quickMeetingExpenseAmount) : null,
        receipt_url: quickMeetingHasExpense && uploadedReceipts.length > 0 ? uploadedReceipts[0].filePath : null,
        created_by: salesPerson.user_id,
        meeting_group_id: meetingGroupId,
        is_primary_for_expense: index === 0,
      }));

      const { data: insertedMeetings, error } = await supabase
        .from('meetings')
        .insert(meetingsToInsert)
        .select('id');

      if (error) throw error;

      if (insertedMeetings && uploadedReceipts.length > 0 && quickMeetingHasExpense) {
        const primaryMeetingId = insertedMeetings[0].id;
        const receiptsToInsert = uploadedReceipts.map(receipt => ({
          meeting_id: primaryMeetingId,
          file_path: receipt.filePath,
          file_name: receipt.fileName,
          created_by: salesPerson.user_id,
        }));

        await supabase.from('meeting_receipts').insert(receiptsToInsert);
      }

      if (quickMeetingHasExpense && quickMeetingExpenseAmount && parseFloat(quickMeetingExpenseAmount) > 0) {
        const result = await deductBudget(salesPerson.id, parseFloat(quickMeetingExpenseAmount));
        if (result.exceeded && result.newBalance !== null) {
          setBudgetWarning(`Your budget has been exceeded. Current balance: ${formatCurrency(result.newBalance)}`);
          setTimeout(() => setBudgetWarning(null), 8000);
        }
      }

      resetQuickMeetingForm();
      await dialog.alert('Meeting logged successfully!');
    } catch (error: any) {
      console.error('Error adding meeting:', error);
      await dialog.alert('Failed to log meeting: ' + error.message);
    } finally {
      setQuickMeetingSaving(false);
    }
  };

  const openQuickMeetingForm = (contactId: string) => {
    setOpenDropdownId(null);
    setQuickMeetingContactId(contactId);
  };

  const exportMyContacts = async () => {
    if (!salesPerson?.id) {
      await dialog.alert('Unable to identify current user');
      return;
    }

    setExportLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          name,
          type,
          email,
          phone,
          company,
          branch,
          address,
          birthday,
          drinks,
          notes,
          created_at,
          assignments!inner (
            salesperson_id
          )
        `)
        .eq('assignments.salesperson_id', salesPerson.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        await dialog.alert('No contacts assigned to you');
        return;
      }

      const worksheetData = data.map((contact: any) => ({
        'Name': contact.name || '',
        'Type': contact.type || '',
        'Email': contact.email || '',
        'Phone': contact.phone || '',
        'Cell Phone': contact.cell_phone || '',
        'Company': contact.company || '',
        'Branch': contact.branch || '',
        'Address': contact.address || '',
        'Birthday': contact.birthday ? formatDateShort(contact.birthday) : '',
        'Drinks': contact.drinks ? 'Yes' : 'No',
        'Notes': contact.notes || '',
        'Created At': new Date(contact.created_at).toLocaleString(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'My Contacts');

      XLSX.writeFile(workbook, `my_contacts_${getTodayDateString()}.xlsx`);
    } catch (error) {
      console.error('Error exporting contacts:', error);
      await dialog.alert('Failed to export contacts');
    } finally {
      setExportLoading(false);
    }
  };

  let filteredContacts = filterType === 'all'
    ? contacts
    : contacts.filter(c => c.type === filterType);

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    const nameVariants = expandSearchTermWithNicknames(searchQuery);

    filteredContacts = filteredContacts.filter(contact => {
      const nameMatch = nameVariants.some(variant =>
        contact.name.toLowerCase().includes(variant.toLowerCase())
      );

      return nameMatch ||
        contact.email?.toLowerCase().includes(query) ||
        contact.phone?.toLowerCase().includes(query) ||
        contact.company?.toLowerCase().includes(query) ||
        contact.branch?.toLowerCase().includes(query) ||
        contact.address?.toLowerCase().includes(query) ||
        contact.notes?.toLowerCase().includes(query);
    });
  }

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    let aValue = '';
    let bValue = '';

    switch (sortField) {
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;
      case 'type':
        aValue = a.type || '';
        bValue = b.type || '';
        break;
      case 'email':
        aValue = a.email || '';
        bValue = b.email || '';
        break;
      case 'phone':
        aValue = a.phone || '';
        bValue = b.phone || '';
        break;
      case 'company':
        aValue = a.company || '';
        bValue = b.company || '';
        break;
    }

    const comparison = aValue.localeCompare(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const contactCounts = {
    all: contacts.length,
    buyer: contacts.filter(c => c.type === 'buyer').length,
    realtor: contacts.filter(c => c.type === 'realtor').length,
    attorney: contacts.filter(c => c.type === 'attorney').length,
    loan_officer: contacts.filter(c => c.type === 'loan_officer').length,
    vendor: contacts.filter(c => c.type === 'vendor').length,
  };

  const handleConfirmDelete = async () => {
    if (!deletingContact || !salesPerson) return;
    setDeleteInProgress(true);
    setDeleteMessage(null);

    try {
      const { data: assignment } = await supabase
        .from('assignments')
        .select('id')
        .eq('contact_id', deletingContact.id)
        .eq('salesperson_id', salesPerson.id)
        .maybeSingle();

      if (!assignment) {
        throw new Error('You are not authorized to delete this contact.');
      }

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', deletingContact.id);

      if (error) throw error;

      const deletedAt = new Date().toISOString();
      // Fire-and-forget email notification to super admin Mike Carella.
      // The edge function requires RESEND_API_KEY to be configured as a Supabase secret.
      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-contact-deleted`;
        await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contactName: deletingContact.name,
            contactEmail: deletingContact.email || null,
            deletedByName: salesPerson.name,
            deletedByUserId: salesPerson.user_id || salesPerson.id,
            deletedAt,
          }),
        });
      } catch (notifyErr) {
        console.error('Failed to send deletion notification:', notifyErr);
      }

      setContacts(prev => prev.filter(c => c.id !== deletingContact.id));
      setDeleteMessage({ type: 'success', text: `Contact "${deletingContact.name}" was deleted.` });
      setDeletingContact(null);
    } catch (err: any) {
      console.error('Error deleting contact:', err);
      setDeleteMessage({ type: 'error', text: err.message || 'Failed to delete contact.' });
    } finally {
      setDeleteInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading your contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${isMobile ? 'p-3' : 'p-6'}`}>
      {budgetWarning && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-medium text-amber-800">{budgetWarning}</span>
          <button onClick={() => setBudgetWarning(null)} className="ml-auto p-1 hover:bg-amber-100 rounded">
            <X className="w-4 h-4 text-amber-600" />
          </button>
        </div>
      )}
      <div className={isMobile ? 'mb-4' : 'mb-6'}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
          <h2 className={`font-bold text-slate-900 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none ${isMobile ? 'text-lg' : 'text-2xl'}`}>
            My Contacts
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleEmailList}
              disabled={selectedContacts.size === 0}
              className={`bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm flex-shrink-0 ${
                isMobile ? 'px-3 py-2 gap-1' : 'px-4 py-2 gap-2'
              }`}
              title={selectedContacts.size === 0 ? 'Select contacts to email' : `Email ${selectedContacts.size} selected contact${selectedContacts.size !== 1 ? 's' : ''}`}
            >
              <Mail className="w-4 h-4" />
              <span>{isMobile ? 'Email' : `Email List${selectedContacts.size > 0 ? ` (${selectedContacts.size})` : ''}`}</span>
            </button>
            {onNavigateToBudgetRequests && (
              <button
                onClick={onNavigateToBudgetRequests}
                className={`bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center text-sm flex-shrink-0 ${
                  isMobile ? 'px-3 py-2 gap-1' : 'px-4 py-2 gap-2'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>{isMobile ? 'F&F' : 'Friends and Family'}</span>
              </button>
            )}
            <button
              onClick={exportMyContacts}
              disabled={exportLoading}
              className={`bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center text-sm flex-shrink-0 ${
                isMobile ? 'px-3 py-2 gap-1' : 'px-4 py-2 gap-2'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{isMobile ? (exportLoading ? 'Export...' : 'Export') : (exportLoading ? 'Exporting...' : 'Export My Contacts')}</span>
            </button>
          </div>
        </div>
        <p className={`text-slate-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>
          View and edit all contacts assigned to you
        </p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
          <input
            type="text"
            placeholder={isMobile ? "Search contacts..." : "Search contacts by name, email, phone, company, branch, address, or notes..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isMobile ? 'py-2 text-sm' : 'py-2'
            }`}
          />
        </div>
        {searchQuery && (
          <div className="mt-2 text-sm text-slate-600">
            Found {sortedContacts.length} contact{sortedContacts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -webkit-overflow-scrolling-touch pb-2">
          <span className="text-xs sm:text-sm font-medium text-slate-700 flex-shrink-0">Sort by:</span>
          <button
            onClick={() => handleSort('name')}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
              sortField === 'name'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Name
            {sortField === 'name' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => handleSort('type')}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
              sortField === 'type'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Type
            {sortField === 'type' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => handleSort('email')}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
              sortField === 'email'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Email
            {sortField === 'email' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => handleSort('phone')}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
              sortField === 'phone'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Phone
            {sortField === 'phone' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => handleSort('company')}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
              sortField === 'company'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Company
            {sortField === 'company' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200"
        >
          {selectedContacts.size === sortedContacts.length && sortedContacts.length > 0 ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          <span>Select All</span>
        </button>
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
            filterType === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All ({contactCounts.all})
        </button>
        <button
          onClick={() => setFilterType('buyer')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
            filterType === 'buyer'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Buyers ({contactCounts.buyer})
        </button>
        <button
          onClick={() => setFilterType('realtor')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
            filterType === 'realtor'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Realtors ({contactCounts.realtor})
        </button>
        <button
          onClick={() => setFilterType('attorney')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
            filterType === 'attorney'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Attorneys ({contactCounts.attorney})
        </button>
        <button
          onClick={() => setFilterType('loan_officer')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
            filterType === 'loan_officer'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Loan Officers ({contactCounts.loan_officer})
        </button>
        <button
          onClick={() => setFilterType('vendor')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
            filterType === 'vendor'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Vendors ({contactCounts.vendor})
        </button>
        </div>
        <div className="mt-3 text-sm font-medium text-slate-700">
          Total Contacts: {sortedContacts.length}
        </div>
      </div>

      {sortedContacts.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No contacts found{filterType !== 'all' ? ` for ${typeLabels[filterType as keyof typeof typeLabels]}` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedContacts.map((contact) => {
            const Icon = typeIcons[contact.type as keyof typeof typeIcons];
            const isEditing = editingId === contact.id;

            return (
              <div
                key={contact.id}
                className={`border border-slate-200 rounded-lg hover:shadow-md transition-shadow ${
                  isMobile ? 'p-3' : 'p-4'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 rounded-lg p-2">
                          <Icon className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">Editing Contact</h3>
                          <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded">
                            {typeLabels[contact.type as keyof typeof typeLabels]}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(contact.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors text-sm"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={editForm.name ?? contact.name ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={editForm.email ?? contact.email ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editForm.phone ?? contact.phone ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                        <input
                          type="text"
                          value={editForm.company ?? contact.company ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Branch</label>
                        <input
                          type="text"
                          value={editForm.branch ?? contact.branch ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Birthday</label>
                        <input
                          type="date"
                          value={editForm.birthday ?? contact.birthday ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Drinks?</label>
                        <select
                          value={(editForm.drinks ?? contact.drinks) ? 'yes' : 'no'}
                          onChange={(e) => setEditForm({ ...editForm, drinks: e.target.value === 'yes' })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Client Type</label>
                        <select
                          value={editForm.client_type ?? contact.client_type ?? 'prospect'}
                          onChange={(e) => setEditForm({ ...editForm, client_type: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="prospect">Prospect</option>
                          <option value="client">Client</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Grade</label>
                        <select
                          value={editForm.grade ?? contact.grade ?? 'C'}
                          onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                        <input
                          type="text"
                          value={editForm.address ?? contact.address ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                        <textarea
                          value={editForm.notes ?? contact.notes ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => toggleContactSelection(contact.id)}
                          className="mt-1 sm:mt-2 p-1 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
                          title={selectedContacts.has(contact.id) ? 'Deselect contact' : 'Select contact'}
                        >
                          {selectedContacts.has(contact.id) ? (
                            <CheckSquare className={`text-blue-600 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                          ) : (
                            <Square className={`text-slate-400 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                          )}
                        </button>
                        <div className={`bg-slate-100 rounded-lg mt-1 flex-shrink-0 ${isMobile ? 'p-1.5' : 'p-2'}`}>
                          <Icon className={`text-slate-600 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className={`font-semibold text-slate-900 ${isMobile ? 'text-sm' : ''}`}>{contact.name}</h3>
                            <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded whitespace-nowrap">
                              {typeLabels[contact.type as keyof typeof typeLabels]}
                            </span>
                            {contact.driver && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200 whitespace-nowrap">
                                <Navigation className="w-2.5 h-2.5" />
                                Driver
                              </span>
                            )}
                          </div>
                          <div className={`text-slate-600 break-words ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            {contact.email && <span className="break-all">{contact.email}</span>}
                            {contact.email && contact.phone && <span className="mx-2">•</span>}
                            {contact.phone && <span>{contact.phone}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                        <button
                          onClick={() => openQuickMeetingForm(contact.id)}
                          className={`flex items-center bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-sm ${
                            isMobile ? 'p-2' : 'gap-1.5 px-3 py-1.5 text-sm font-medium'
                          }`}
                          title="Log Meeting"
                        >
                          <Calendar className="w-4 h-4" />
                          {!isMobile && 'Log Meeting'}
                        </button>
                        <button
                          onClick={() => setViewingContactId(contact.id)}
                          className={`flex items-center bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors ${
                            isMobile ? 'p-2' : 'gap-1 px-3 py-1.5 text-sm'
                          }`}
                          title="View contact"
                        >
                          <Eye className="w-4 h-4" />
                          {!isMobile && 'View'}
                        </button>
                        <button
                          onClick={() => handleEdit(contact)}
                          className={`flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ${
                            isMobile ? 'p-2' : 'gap-1 px-3 py-1.5 text-sm'
                          }`}
                          title="Edit contact"
                        >
                          <Edit2 className="w-4 h-4" />
                          {!isMobile && 'Edit'}
                        </button>
                        <button
                          onClick={() => { setDeleteMessage(null); setDeletingContact(contact); }}
                          className={`flex items-center bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors ${
                            isMobile ? 'p-2' : 'gap-1 px-3 py-1.5 text-sm'
                          }`}
                          title="Delete contact"
                        >
                          <Trash2 className="w-4 h-4" />
                          {!isMobile && 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewingContactId && (
        <ContactView
          contactId={viewingContactId}
          onClose={() => {
            setViewingContactId(null);
            loadContacts();
          }}
        />
      )}

      {editingContact && (
        <ContactEditModal
          key={editingContact.id}
          contact={editingContact}
          salesPeople={salesPeople}
          isAdminOrProcessor={isAdminOrProcessor}
          isAdmin={isAdmin}
          onSave={() => {
            setEditingContact(null);
            setEditingId(null);
            setEditForm({});
            loadContacts();
          }}
          onCancel={() => setEditingContact(null)}
        />
      )}

      {deleteMessage && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
            deleteMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <span className="text-sm font-medium">{deleteMessage.text}</span>
          <button onClick={() => setDeleteMessage(null)} className="hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {deletingContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Delete Contact</h3>
                  <p className="text-sm text-slate-600">
                    Are you sure you want to delete <span className="font-semibold">{deletingContact.name}</span>? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeletingContact(null)}
                  disabled={deleteInProgress}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteInProgress}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {deleteInProgress ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickMeetingContactId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Log Meeting</h3>
                  <p className="text-sm text-slate-500">
                    {contacts.find(c => c.id === quickMeetingContactId)?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={resetQuickMeetingForm}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleQuickMeetingSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={quickMeetingDate}
                  onChange={(e) => setQuickMeetingDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Meeting Type</label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quickMeetingIsMeeting}
                      onChange={(e) => setQuickMeetingIsMeeting(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700">In-Person</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quickMeetingIsCall}
                      onChange={(e) => setQuickMeetingIsCall(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700">Call</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quickMeetingIsText}
                      onChange={(e) => setQuickMeetingIsText(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700">Text</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quickMeetingIsEmail}
                      onChange={(e) => setQuickMeetingIsEmail(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700">Email</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={quickMeetingNotes}
                  onChange={(e) => setQuickMeetingNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Enter meeting notes..."
                  required
                />
              </div>

              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowQuickMeetingAdditionalContacts(!showQuickMeetingAdditionalContacts)}
                  className="flex items-center justify-between w-full text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Apply to Additional Contacts</span>
                    {quickMeetingAdditionalContacts.size > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs font-semibold">
                        {quickMeetingAdditionalContacts.size} selected
                      </span>
                    )}
                  </div>
                  {showQuickMeetingAdditionalContacts ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showQuickMeetingAdditionalContacts && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {contacts.filter(c => c.id !== quickMeetingContactId).length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-2">No other contacts available</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-600 mb-2">Select contacts to apply this same meeting log to:</p>
                        {contacts
                          .filter(c => c.id !== quickMeetingContactId)
                          .map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                const newSet = new Set(quickMeetingAdditionalContacts);
                                if (newSet.has(c.id)) {
                                  newSet.delete(c.id);
                                } else {
                                  newSet.add(c.id);
                                }
                                setQuickMeetingAdditionalContacts(newSet);
                              }}
                              className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                            >
                              <div className="flex-shrink-0">
                                {quickMeetingAdditionalContacts.has(c.id) ? (
                                  <CheckSquare className="w-5 h-5 text-amber-600" />
                                ) : (
                                  <Square className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-slate-900 font-medium">{c.name}</span>
                                <span className="text-xs text-slate-500 ml-2 capitalize">
                                  ({typeLabels[c.type as keyof typeof typeLabels]})
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Expense?</label>
                <div className="flex gap-4">
                  <label className={`flex-1 p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${
                    quickMeetingHasExpense === true ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="hasExpense"
                      checked={quickMeetingHasExpense === true}
                      onChange={() => setQuickMeetingHasExpense(true)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">Yes</span>
                  </label>
                  <label className={`flex-1 p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${
                    quickMeetingHasExpense === false ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="hasExpense"
                      checked={quickMeetingHasExpense === false}
                      onChange={() => setQuickMeetingHasExpense(false)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">No</span>
                  </label>
                </div>
              </div>

              {quickMeetingHasExpense && (
                <div className={`space-y-4 p-4 rounded-lg ${!quickMeetingExpenseMethod ? 'bg-red-50 border-2 border-red-300' : 'bg-slate-50'}`}>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    {!quickMeetingExpenseMethod && (
                      <p className="text-xs text-red-500 mb-1">Please select a payment method</p>
                    )}
                    <select
                      value={quickMeetingExpenseMethod}
                      onChange={(e) => setQuickMeetingExpenseMethod(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${!quickMeetingExpenseMethod ? 'border-red-400' : 'border-slate-300'}`}
                    >
                      <option value="">Select method...</option>
                      <option value="company">Company Credit Card</option>
                      <option value="personal">Personal Credit Card</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={quickMeetingExpenseAmount}
                        onChange={(e) => setQuickMeetingExpenseAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Receipt(s)</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <Upload className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-700">Upload</span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              setQuickMeetingReceiptFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                            }
                          }}
                          className="sr-only"
                        />
                      </label>
                      {quickMeetingReceiptFiles.length > 0 && (
                        <span className="text-sm text-slate-600">
                          {quickMeetingReceiptFiles.length} file(s) selected
                        </span>
                      )}
                    </div>
                    {quickMeetingReceiptFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {quickMeetingReceiptFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between text-sm bg-white px-3 py-1.5 rounded border border-slate-200">
                            <span className="truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setQuickMeetingReceiptFiles(prev => prev.filter((_, i) => i !== index))}
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetQuickMeetingForm}
                  disabled={quickMeetingSaving}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickMeetingSaving || !quickMeetingNotes.trim() || quickMeetingHasExpense === null || (quickMeetingHasExpense && !quickMeetingExpenseMethod)}
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                >
                  {quickMeetingSaving ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      {quickMeetingAdditionalContacts.size > 0
                        ? `Log for ${quickMeetingAdditionalContacts.size + 1} Contacts`
                        : 'Log Meeting'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
