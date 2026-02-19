import { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Building2, MapPin, FileText, Calendar, Plus, Edit2, Trash2, Save, Shield, Cake, Wine, Tag, Star, TrendingUp, Users, CheckSquare, Square, Upload, Download, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDateShort, formatDateWithWeekday, getTodayDateString } from '../lib/dateUtils';
import { convertToJpeg, isImageFile } from '../lib/imageUtils';

interface Contact {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  company?: string;
  branch?: string;
  address?: string;
  client_identifier_no?: string;
  paralegal?: string;
  client_paralegal_processor?: string;
  evident_paralegal?: string;
  preferred_surveyor?: string;
  preferred_uw?: string;
  preferred_closer?: string;
  birthday?: string;
  drinks?: boolean;
  client_type?: string;
  grade?: string;
  marketing_points?: number;
  notes?: string;
  processor_notes?: string;
  created_at: string;
  assignments?: Array<{
    salesperson_id: string;
  }>;
}

interface Meeting {
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
  sales_people?: {
    name: string;
  };
}

interface ContactViewProps {
  contactId: string;
  onClose: () => void;
}

const typeLabels = {
  buyer: 'Buyer',
  realtor: 'Realtor',
  loan_officer: 'Loan Officer',
  attorney: 'Attorney',
  vendor: 'Vendor',
};

export function ContactView({ contactId, onClose }: ContactViewProps) {
  const { user, salesPerson, isAdminOrProcessor } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [meetingDate, setMeetingDate] = useState(getTodayDateString());
  const [meetingNotes, setMeetingNotes] = useState('');
  const [isMeeting, setIsMeeting] = useState(false);
  const [isText, setIsText] = useState(false);
  const [isCall, setIsCall] = useState(false);
  const [isEmail, setIsEmail] = useState(false);
  const [hasExpense, setHasExpense] = useState<boolean | null>(null);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editMeetingForm, setEditMeetingForm] = useState<{ date: string; notes: string; is_meeting: boolean; is_text: boolean; is_call: boolean; is_email: boolean; has_expense: boolean; expense_payment_method: string; expense_amount: string; receipt_file: File | null }>({ date: '', notes: '', is_meeting: false, is_text: false, is_call: false, is_email: false, has_expense: false, expense_payment_method: '', expense_amount: '', receipt_file: null });
  const [isOwnContact, setIsOwnContact] = useState(false);
  const [additionalContacts, setAdditionalContacts] = useState<Set<string>>(new Set());
  const [userContacts, setUserContacts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [showAdditionalContacts, setShowAdditionalContacts] = useState(true);

  useEffect(() => {
    loadContactData();
    loadUserContacts();
  }, [contactId]);

  const loadUserContacts = async () => {
    if (!salesPerson?.id) return;

    try {
      const { data: sharedAccess } = await supabase
        .from('shared_contact_access')
        .select('salesperson_id')
        .eq('viewer_id', salesPerson.id);

      const accessibleSalespeopleIds = [salesPerson.id];
      if (sharedAccess) {
        accessibleSalespeopleIds.push(...sharedAccess.map(sa => sa.salesperson_id));
      }

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          name,
          type,
          assignments!inner (
            salesperson_id
          )
        `)
        .in('assignments.salesperson_id', accessibleSalespeopleIds)
        .neq('id', contactId)
        .order('name');

      if (error) throw error;
      setUserContacts(data || []);
    } catch (error) {
      console.error('Error loading user contacts:', error);
    }
  };

  const loadContactData = async () => {
    setLoading(true);
    try {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('*, assignments(salesperson_id)')
        .eq('id', contactId)
        .single();

      if (contactError) throw contactError;
      setContact(contactData);

      const isOwn = contactData.assignments?.some(
        (assignment: any) => assignment.salesperson_id === salesPerson?.id
      ) || false;
      setIsOwnContact(isOwn);

      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('*, sales_people(name)')
        .eq('contact_id', contactId)
        .order('meeting_date', { ascending: false });

      if (meetingsError) throw meetingsError;
      setMeetings(meetingsData || []);
    } catch (error) {
      console.error('Error loading contact data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesPerson?.id || !meetingNotes.trim() || hasExpense === null) return;

    setSavingMeeting(true);
    try {
      let receiptUrl = null;

      // Upload receipt if exists
      if (receiptFile) {
        let fileToUpload = receiptFile;

        // Check if it's an image that needs conversion
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

        const fileName = `${salesPerson.user_id}_${Date.now()}.jpeg`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, fileToUpload);

        if (uploadError) throw uploadError;
        receiptUrl = filePath;
      }

      const contactsToLog = [contactId, ...Array.from(additionalContacts)];

      // Generate a group ID if logging to multiple contacts
      const meetingGroupId = contactsToLog.length > 1 ? crypto.randomUUID() : null;

      const meetingsToInsert = contactsToLog.map((cId, index) => ({
        contact_id: cId,
        salesperson_id: salesPerson.id,
        meeting_date: meetingDate,
        notes: meetingNotes,
        is_meeting: isMeeting,
        is_text: isText,
        is_call: isCall,
        is_email: isEmail,
        has_expense: hasExpense,
        expense_payment_method: hasExpense ? expensePaymentMethod : null,
        expense_amount: hasExpense && expenseAmount ? parseFloat(expenseAmount) : null,
        receipt_url: hasExpense ? receiptUrl : null,
        created_by: salesPerson.user_id,
        meeting_group_id: meetingGroupId,
        // Only the first meeting (primary contact) shows expense/receipt in exports
        is_primary_for_expense: index === 0,
      }));

      const { error } = await supabase
        .from('meetings')
        .insert(meetingsToInsert);

      if (error) throw error;

      setMeetingNotes('');
      setMeetingDate(getTodayDateString());
      setIsMeeting(false);
      setIsText(false);
      setIsCall(false);
      setIsEmail(false);
      setHasExpense(null);
      setExpensePaymentMethod('');
      setExpenseAmount('');
      setReceiptFile(null);
      setAdditionalContacts(new Set());
      setShowAdditionalContacts(false);
      setShowAddMeeting(false);
      loadContactData();
    } catch (error: any) {
      console.error('Error adding meeting:', error);
      const errorMessage = 'Failed to add meeting: ' + error.message;
      console.error(errorMessage);
    } finally {
      setSavingMeeting(false);
    }
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeetingId(meeting.id);
    setEditMeetingForm({
      date: meeting.meeting_date,
      notes: meeting.notes,
      is_meeting: meeting.is_meeting || false,
      is_text: meeting.is_text || false,
      is_call: meeting.is_call || false,
      is_email: meeting.is_email || false,
      has_expense: meeting.has_expense || false,
      expense_payment_method: meeting.expense_payment_method || '',
      expense_amount: meeting.expense_amount ? meeting.expense_amount.toString() : '',
      receipt_file: null,
    });
  };

  const handleSaveMeeting = async (meetingId: string) => {
    try {
      let receiptUrl = meetings.find(m => m.id === meetingId)?.receipt_url || null;

      // Upload new receipt if exists
      if (editMeetingForm.receipt_file) {
        let fileToUpload = editMeetingForm.receipt_file;

        // Check if it's an image that needs conversion
        const fileExtension = '.' + editMeetingForm.receipt_file.name.split('.').pop()?.toLowerCase();
        const isImage = editMeetingForm.receipt_file.type.startsWith('image/');

        if (isImage) {
          if (isImageFile(editMeetingForm.receipt_file)) {
            try {
              fileToUpload = await convertToJpeg(editMeetingForm.receipt_file);
            } catch (error) {
              console.error('Failed to convert image to JPEG:', error);
              throw error instanceof Error ? error : new Error('Failed to process receipt image. Please try again.');
            }
          } else {
            throw new Error(`RAW image format ${fileExtension.toUpperCase()} is not supported. Please convert to JPG, PNG, or another standard format first.`);
          }
        }

        const fileName = `${salesPerson?.user_id}_${Date.now()}.jpeg`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, fileToUpload);

        if (uploadError) throw uploadError;
        receiptUrl = filePath;
      }

      const { error } = await supabase
        .from('meetings')
        .update({
          meeting_date: editMeetingForm.date,
          notes: editMeetingForm.notes,
          is_meeting: editMeetingForm.is_meeting,
          is_text: editMeetingForm.is_text,
          is_call: editMeetingForm.is_call,
          is_email: editMeetingForm.is_email,
          has_expense: editMeetingForm.has_expense,
          expense_payment_method: editMeetingForm.has_expense ? editMeetingForm.expense_payment_method : null,
          expense_amount: editMeetingForm.has_expense && editMeetingForm.expense_amount ? parseFloat(editMeetingForm.expense_amount) : null,
          receipt_url: editMeetingForm.has_expense ? receiptUrl : null,
        })
        .eq('id', meetingId);

      if (error) throw error;

      setEditingMeetingId(null);
      setEditMeetingForm({ date: '', notes: '', is_meeting: false, is_text: false, is_call: false, is_email: false, has_expense: false, expense_payment_method: '', expense_amount: '', receipt_file: null });
      loadContactData();
    } catch (error: any) {
      console.error('Error updating meeting:', error);
      const errorMessage = 'Failed to update meeting: ' + error.message;
      console.error(errorMessage);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;
      loadContactData();
    } catch (error: any) {
      console.error('Error deleting meeting:', error);
      const errorMessage = 'Failed to delete meeting: ' + error.message;
      console.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4">
          <p className="text-center text-slate-600">Loading contact details...</p>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4">
          <p className="text-center text-red-600">Contact not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors mx-auto block"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 my-8">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Contact Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="bg-slate-50 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 rounded-full p-3">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-slate-900 mb-1">{contact.name}</h3>
                <span className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                  {typeLabels[contact.type as keyof typeof typeLabels]}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contact.email && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Mail className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Email</p>
                  <p className="text-slate-900">{contact.email}</p>
                </div>
              </div>
            )}

            {contact.phone && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Phone className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Phone</p>
                  <p className="text-slate-900">{contact.phone}</p>
                </div>
              </div>
            )}

            {contact.cell_phone && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Phone className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Cell Phone</p>
                  <p className="text-slate-900">{contact.cell_phone}</p>
                </div>
              </div>
            )}

            {contact.company && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Building2 className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Company</p>
                  <p className="text-slate-900">{contact.company}</p>
                </div>
              </div>
            )}

            {contact.client_identifier_no && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Tag className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Client Identifier No.</p>
                  <p className="text-slate-900">{contact.client_identifier_no}</p>
                </div>
              </div>
            )}

            {contact.branch && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Building2 className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Branch</p>
                  <p className="text-slate-900">{contact.branch}</p>
                </div>
              </div>
            )}

            {contact.address && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg md:col-span-2">
                <MapPin className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Address</p>
                  <p className="text-slate-900">{contact.address}</p>
                </div>
              </div>
            )}

            {contact.type === 'attorney' && contact.paralegal && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <User className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Evident Paralegal</p>
                  <p className="text-slate-900">{contact.paralegal}</p>
                </div>
              </div>
            )}

            {contact.client_paralegal_processor && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <User className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Client Paralegal/Processor</p>
                  <p className="text-slate-900">{contact.client_paralegal_processor}</p>
                </div>
              </div>
            )}

            {contact.evident_paralegal && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <User className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Evident Paralegal</p>
                  <p className="text-slate-900">{contact.evident_paralegal}</p>
                </div>
              </div>
            )}

            {contact.birthday && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Cake className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Birthday</p>
                  <p className="text-slate-900">{formatDateShort(contact.birthday)}</p>
                </div>
              </div>
            )}

            {contact.client_type && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Tag className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Client Type</p>
                  <p className="text-slate-900 capitalize">{contact.client_type}</p>
                </div>
              </div>
            )}

            {contact.grade && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Star className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Grade</p>
                  <p className="text-slate-900">{contact.grade}</p>
                </div>
              </div>
            )}

            {contact.drinks !== null && contact.drinks !== undefined && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Wine className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Drinks</p>
                  <p className="text-slate-900">{contact.drinks ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}

            {contact.marketing_points !== null && contact.marketing_points !== undefined && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Marketing Points</p>
                  <p className="text-slate-900 font-semibold">{contact.marketing_points}</p>
                </div>
              </div>
            )}

            {isAdminOrProcessor && contact.preferred_surveyor && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">Preferred Surveyor</p>
                  <p className="text-slate-900">{contact.preferred_surveyor}</p>
                </div>
              </div>
            )}

            {isAdminOrProcessor && contact.preferred_uw && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">Preferred UW</p>
                  <p className="text-slate-900">{contact.preferred_uw}</p>
                </div>
              </div>
            )}

            {isAdminOrProcessor && contact.preferred_closer && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">Preferred Closer</p>
                  <p className="text-slate-900">{contact.preferred_closer}</p>
                </div>
              </div>
            )}

            {contact.notes && (
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg md:col-span-2">
                <FileText className="w-5 h-5 text-slate-600 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-medium mb-1">General Notes</p>
                  <p className="text-slate-900 whitespace-pre-wrap">{contact.notes}</p>
                </div>
              </div>
            )}

            {isAdminOrProcessor && contact.processor_notes && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg md:col-span-2">
                <Shield className="w-5 h-5 text-amber-600 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-amber-700 font-medium mb-1">Processor Notes (Admin/Processor Only)</p>
                  <p className="text-slate-900 whitespace-pre-wrap">{contact.processor_notes}</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Meetings
              </h3>
              {!showAddMeeting && (isOwnContact || isAdminOrProcessor) && (
                <button
                  onClick={() => setShowAddMeeting(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Log Meeting
                </button>
              )}
            </div>

            {showAddMeeting && (isOwnContact || isAdminOrProcessor) && (
              <form onSubmit={handleAddMeeting} className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-slate-900 mb-3">Log New Meeting</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Meeting Date *
                    </label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Interaction Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isMeeting}
                          onChange={(e) => setIsMeeting(e.target.checked)}
                          className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-slate-700">Meeting</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isText}
                          onChange={(e) => setIsText(e.target.checked)}
                          className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-slate-700">Text</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isCall}
                          onChange={(e) => setIsCall(e.target.checked)}
                          className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-slate-700">Call</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEmail}
                          onChange={(e) => setIsEmail(e.target.checked)}
                          className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-slate-700">Email</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Meeting Notes *
                    </label>
                    <textarea
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      rows={4}
                      placeholder="What was discussed during the meeting?"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      required
                    />
                  </div>
                  <div className="border-t border-green-200 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => setShowAdditionalContacts(!showAdditionalContacts)}
                        className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 font-medium"
                      >
                        <Users className="w-4 h-4" />
                        <span>Apply to Additional Contacts</span>
                        {additionalContacts.size > 0 && (
                          <span className="px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-semibold">
                            {additionalContacts.size} selected
                          </span>
                        )}
                      </button>
                      {showAdditionalContacts && (
                        <button
                          type="button"
                          onClick={() => setShowAdditionalContacts(false)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Hide
                        </button>
                      )}
                    </div>
                    {showAdditionalContacts && (
                      <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 max-h-60 overflow-y-auto">
                        {userContacts.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-2">No other contacts available</p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-xs text-slate-600 mb-2">Select contacts to apply this same meeting log to:</p>
                            {userContacts.map(contact => (
                              <div
                                key={contact.id}
                                onClick={() => {
                                  const newSet = new Set(additionalContacts);
                                  if (newSet.has(contact.id)) {
                                    newSet.delete(contact.id);
                                  } else {
                                    newSet.add(contact.id);
                                  }
                                  setAdditionalContacts(newSet);
                                }}
                                className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                              >
                                <div className="flex-shrink-0">
                                  {additionalContacts.has(contact.id) ? (
                                    <CheckSquare className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <span className="text-sm text-slate-900 font-medium">{contact.name}</span>
                                  <span className="text-xs text-slate-500 ml-2 capitalize">({typeLabels[contact.type as keyof typeof typeLabels]})</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-green-200 pt-4 mt-3">
                    <div className={`p-4 rounded-lg border-2 ${hasExpense === null ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300'}`}>
                      <p className="text-base font-bold text-slate-800 mb-3">
                        Did this meeting have an expense? *
                      </p>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="has-expense"
                            checked={hasExpense === true}
                            onChange={() => setHasExpense(true)}
                            className="w-5 h-5 text-yellow-600 focus:ring-yellow-500"
                            required
                          />
                          <span className="text-base font-medium text-slate-700">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="has-expense"
                            checked={hasExpense === false}
                            onChange={() => {
                              setHasExpense(false);
                              setExpensePaymentMethod('');
                              setExpenseAmount('');
                              setReceiptFile(null);
                            }}
                            className="w-5 h-5 text-yellow-600 focus:ring-yellow-500"
                            required
                          />
                          <span className="text-base font-medium text-slate-700">No</span>
                        </label>
                      </div>
                    </div>
                    {hasExpense === true && (
                      <div className="mt-3 p-4 bg-white border-2 border-yellow-300 rounded-lg">
                        <p className="text-sm font-semibold text-slate-700 mb-3">Payment Method:</p>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="payment-method"
                              value="personal"
                              checked={expensePaymentMethod === 'personal'}
                              onChange={(e) => setExpensePaymentMethod(e.target.value)}
                              className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                            />
                            <span className="text-sm text-slate-700">Personal Credit Card</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="payment-method"
                              value="company"
                              checked={expensePaymentMethod === 'company'}
                              onChange={(e) => setExpensePaymentMethod(e.target.value)}
                              className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                            />
                            <span className="text-sm text-slate-700">Company Credit Card</span>
                          </label>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              <DollarSign className="w-4 h-4 inline mr-1" />
                              Expense Amount
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={expenseAmount}
                              onChange={(e) => setExpenseAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              <Upload className="w-4 h-4 inline mr-1" />
                              Upload Receipt
                            </label>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingMeeting}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {savingMeeting ? 'Saving...' : (additionalContacts.size > 0 ? `Save for ${additionalContacts.size + 1} Contact${additionalContacts.size + 1 !== 1 ? 's' : ''}` : 'Save Meeting')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMeeting(false);
                        setMeetingNotes('');
                        setMeetingDate(getTodayDateString());
                        setIsMeeting(false);
                        setIsText(false);
                        setIsCall(false);
                        setIsEmail(false);
                        setHasExpense(null);
                        setExpensePaymentMethod('');
                        setExpenseAmount('');
                        setReceiptFile(null);
                        setAdditionalContacts(new Set());
                        setShowAdditionalContacts(false);
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            {meetings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No meetings logged yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {editingMeetingId === meeting.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Meeting Date
                          </label>
                          <input
                            type="date"
                            value={editMeetingForm.date}
                            onChange={(e) => setEditMeetingForm({ ...editMeetingForm, date: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Interaction Type
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editMeetingForm.is_meeting}
                                onChange={(e) => setEditMeetingForm({ ...editMeetingForm, is_meeting: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Meeting</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editMeetingForm.is_text}
                                onChange={(e) => setEditMeetingForm({ ...editMeetingForm, is_text: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Text</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editMeetingForm.is_call}
                                onChange={(e) => setEditMeetingForm({ ...editMeetingForm, is_call: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Call</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editMeetingForm.is_email}
                                onChange={(e) => setEditMeetingForm({ ...editMeetingForm, is_email: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Email</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Meeting Notes
                          </label>
                          <textarea
                            value={editMeetingForm.notes}
                            onChange={(e) => setEditMeetingForm({ ...editMeetingForm, notes: e.target.value })}
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                        </div>
                        <div>
                          <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                            <p className="text-base font-bold text-slate-800 mb-3">
                              Did this meeting have an expense? *
                            </p>
                            <div className="flex gap-6">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="edit-has-expense"
                                  checked={editMeetingForm.has_expense === true}
                                  onChange={() => setEditMeetingForm({ ...editMeetingForm, has_expense: true })}
                                  className="w-5 h-5 text-yellow-600 focus:ring-yellow-500"
                                />
                                <span className="text-base font-medium text-slate-700">Yes</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="edit-has-expense"
                                  checked={editMeetingForm.has_expense === false}
                                  onChange={() => setEditMeetingForm({
                                    ...editMeetingForm,
                                    has_expense: false,
                                    expense_payment_method: '',
                                    expense_amount: '',
                                    receipt_file: null
                                  })}
                                  className="w-5 h-5 text-yellow-600 focus:ring-yellow-500"
                                />
                                <span className="text-base font-medium text-slate-700">No</span>
                              </label>
                            </div>
                          </div>
                          {editMeetingForm.has_expense === true && (
                            <div className="mt-3 p-4 bg-white border-2 border-yellow-300 rounded-lg">
                              <p className="text-sm font-semibold text-slate-700 mb-3">Payment Method:</p>
                              <div className="flex gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="edit-payment-method"
                                    value="personal"
                                    checked={editMeetingForm.expense_payment_method === 'personal'}
                                    onChange={(e) => setEditMeetingForm({ ...editMeetingForm, expense_payment_method: e.target.value })}
                                    className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                                  />
                                  <span className="text-sm text-slate-700">Personal Credit Card</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="edit-payment-method"
                                    value="company"
                                    checked={editMeetingForm.expense_payment_method === 'company'}
                                    onChange={(e) => setEditMeetingForm({ ...editMeetingForm, expense_payment_method: e.target.value })}
                                    className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                                  />
                                  <span className="text-sm text-slate-700">Company Credit Card</span>
                                </label>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    <DollarSign className="w-4 h-4 inline mr-1" />
                                    Expense Amount
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editMeetingForm.expense_amount}
                                    onChange={(e) => setEditMeetingForm({ ...editMeetingForm, expense_amount: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    <Upload className="w-4 h-4 inline mr-1" />
                                    Upload New Receipt
                                  </label>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => setEditMeetingForm({ ...editMeetingForm, receipt_file: e.target.files?.[0] || null })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveMeeting(meeting.id)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Save className="w-4 h-4" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingMeetingId(null);
                              setEditMeetingForm({ date: '', notes: '', is_meeting: false, is_text: false, is_call: false, is_email: false, has_expense: false, expense_payment_method: '', expense_amount: '', receipt_file: null });
                            }}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="w-4 h-4 text-blue-600" />
                              <span className="font-semibold text-slate-900">
                                {formatDateWithWeekday(meeting.meeting_date)}
                              </span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
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
                              {meeting.has_expense && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                                  Expense{meeting.expense_payment_method ? ` (${meeting.expense_payment_method === 'personal' ? 'Personal' : 'Company'})` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditMeeting(meeting)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{meeting.notes}</p>
                        {meeting.has_expense && (meeting.expense_amount || meeting.receipt_url) && (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-4">
                              {meeting.expense_amount && (
                                <div className="flex items-center gap-1 text-sm">
                                  <DollarSign className="w-4 h-4 text-yellow-700" />
                                  <span className="font-semibold text-yellow-900">
                                    ${parseFloat(meeting.expense_amount.toString()).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {meeting.receipt_url && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const { data: fileData, error } = await supabase.storage
                                        .from('receipts')
                                        .download(meeting.receipt_url!);

                                      if (error) {
                                        console.error('Error downloading receipt:', error);
                                        alert('Failed to load receipt. Please try again.');
                                        return;
                                      }

                                      if (fileData) {
                                        const blobUrl = URL.createObjectURL(fileData);
                                        window.open(blobUrl, '_blank');
                                        // Clean up blob URL after a delay
                                        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                                      }
                                    } catch (error) {
                                      console.error('Error loading receipt:', error);
                                      alert('Failed to load receipt. Please try again.');
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-sm text-yellow-700 hover:bg-yellow-100 rounded transition-colors"
                                >
                                  <Download className="w-4 h-4" />
                                  View Receipt
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="mt-2 text-xs text-slate-500">
                          Logged by {meeting.sales_people?.name || 'Unknown'} on{' '}
                          {new Date(meeting.created_at).toLocaleDateString()}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
