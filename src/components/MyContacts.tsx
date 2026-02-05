import { useState, useEffect } from 'react';
import { User, Users, Briefcase, Scale, Wrench, Edit2, X, Save, Loader, ArrowUpDown, ArrowUp, ArrowDown, Search, Eye, Download, ChevronDown, ChevronUp, Cake, Mail, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDeviceDetection } from '../lib/deviceDetection';
import { ContactView } from './ContactView';
import { formatContactData } from '../lib/formatters';
import { ContactEditModal } from './ContactEditModal';
import { expandSearchTermWithNicknames } from '../lib/nicknameMapper';
import { formatDateShort, getESTToday, getTodayDateString } from '../lib/dateUtils';
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

export function MyContacts() {
  const { salesPerson, isAdminOrProcessor, isAdmin, user } = useAuth();
  const { isMobile } = useDeviceDetection();
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
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());
  const [showUpcomingBirthdays, setShowUpcomingBirthdays] = useState(false);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

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
      // Get list of salesperson IDs this user has access to (their own + shared access)
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
          *,
          assignments!inner (
            salesperson_id
          )
        `)
        .in('assignments.salesperson_id', accessibleSalespeopleIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUpcomingBirthdays = async () => {
    if (!salesPerson?.id) return;

    try {
      // Get list of salesperson IDs this user has access to
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
          *,
          assignments!inner (
            salesperson_id
          )
        `)
        .in('assignments.salesperson_id', accessibleSalespeopleIds)
        .not('birthday', 'is', null);

      if (error) throw error;

      const today = getESTToday();
      const todayMD = { month: today.getMonth() + 1, day: today.getDate() };

      const fiveDaysFromNow = new Date(today);
      fiveDaysFromNow.setDate(today.getDate() + 5);

      const upcoming = (data || []).filter(contact => {
        if (!contact.birthday) return false;

        // Parse birthday correctly to avoid timezone issues
        const [year, month, day] = contact.birthday.split('-').map(Number);
        const birthdayDate = new Date(year, month - 1, day);
        const birthdayMD = { month: birthdayDate.getMonth() + 1, day: birthdayDate.getDate() };

        for (let i = 0; i <= 5; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() + i);
          const checkMD = { month: checkDate.getMonth() + 1, day: checkDate.getDate() };

          if (birthdayMD.month === checkMD.month && birthdayMD.day === checkMD.day) {
            return true;
          }
        }

        return false;
      }).sort((a, b) => {
        // Parse birthdays correctly to avoid timezone issues
        const [aYear, aMonth, aDay] = a.birthday!.split('-').map(Number);
        const [bYear, bMonth, bDay] = b.birthday!.split('-').map(Number);
        const aDate = new Date(aYear, aMonth - 1, aDay);
        const bDate = new Date(bYear, bMonth - 1, bDay);
        const aMD = { month: aDate.getMonth() + 1, day: aDate.getDate() };
        const bMD = { month: bDate.getMonth() + 1, day: bDate.getDate() };

        const getDaysUntil = (md: { month: number; day: number }) => {
          for (let i = 0; i <= 5; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);
            const checkMD = { month: checkDate.getMonth() + 1, day: checkDate.getDate() };
            if (md.month === checkMD.month && md.day === checkMD.day) {
              return i;
            }
          }
          return 999;
        };

        return getDaysUntil(aMD) - getDaysUntil(bMD);
      });

      setUpcomingBirthdays(upcoming);
      setShowUpcomingBirthdays(true);
    } catch (error) {
      console.error('Error loading upcoming birthdays:', error);
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
      alert('Failed to update contact: ' + error.message);
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

  const handleEmailList = () => {
    const selectedEmails = contacts
      .filter(c => selectedContacts.has(c.id) && c.email)
      .map(c => c.email)
      .filter(Boolean);

    if (selectedEmails.length === 0) {
      alert('Please select at least one contact with an email address');
      return;
    }

    window.location.href = `mailto:?bcc=${selectedEmails.join(',')}`;
  };

  const exportMyContacts = async () => {
    if (!salesPerson?.id) {
      alert('Unable to identify current user');
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
        alert('No contacts assigned to you');
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
      alert('Failed to export contacts');
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
    <div className={`bg-white rounded-xl shadow-sm ${isMobile ? 'p-3' : 'p-6'}`}>
      <div className={isMobile ? 'mb-4' : 'mb-6'}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <h2 className={`font-bold text-slate-900 ${isMobile ? 'text-lg' : 'text-2xl'}`}>
            My Contacts
          </h2>
          <div className="flex items-center gap-2">
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
            <button
              onClick={loadUpcomingBirthdays}
              className={`bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-lg transition-colors flex items-center text-sm flex-shrink-0 ${
                isMobile ? 'px-3 py-2 gap-1' : 'px-4 py-2 gap-2'
              }`}
            >
              <Cake className="w-4 h-4" />
              <span>{isMobile ? 'Birthdays' : 'Upcoming Birthdays'}</span>
            </button>
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search contacts by name, email, phone, company, branch, address, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
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
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => toggleContactSelection(contact.id)}
                          className="mt-2 p-1 hover:bg-slate-100 rounded transition-colors"
                          title={selectedContacts.has(contact.id) ? 'Deselect contact' : 'Select contact'}
                        >
                          {selectedContacts.has(contact.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        <div className="bg-slate-100 rounded-lg p-2 mt-1">
                          <Icon className="w-5 h-5 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900">{contact.name}</h3>
                            <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded">
                              {typeLabels[contact.type as keyof typeof typeLabels]}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">
                            {contact.email && <span>{contact.email}</span>}
                            {contact.email && contact.phone && <span className="mx-2">•</span>}
                            {contact.phone && <span>{contact.phone}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedContacts);
                            if (newExpanded.has(contact.id)) {
                              newExpanded.delete(contact.id);
                            } else {
                              newExpanded.add(contact.id);
                            }
                            setExpandedContacts(newExpanded);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
                        >
                          {expandedContacts.has(contact.id) ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Collapse
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              Expand
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setViewingContactId(contact.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(contact)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                      </div>
                    </div>

                    {expandedContacts.has(contact.id) && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {contact.branch && (
                            <div>
                              <span className="font-medium text-slate-700">Branch:</span>
                              <span className="ml-2 text-slate-600">{contact.branch}</span>
                            </div>
                          )}
                          {contact.company && (
                            <div>
                              <span className="font-medium text-slate-700">Company:</span>
                              <span className="ml-2 text-slate-600">{contact.company}</span>
                            </div>
                          )}
                          {contact.client_paralegal_processor && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-slate-700">Client Paralegal/Processor:</span>
                              <span className="ml-2 text-slate-600">{contact.client_paralegal_processor}</span>
                            </div>
                          )}
                          {contact.evident_paralegal && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-slate-700">Evident Paralegal:</span>
                              <span className="ml-2 text-slate-600">{contact.evident_paralegal}</span>
                            </div>
                          )}
                          {contact.address && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-slate-700">Address:</span>
                              <span className="ml-2 text-slate-600">{contact.address}</span>
                            </div>
                          )}
                          {contact.notes && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-slate-700">Notes:</span>
                              <p className="mt-1 text-slate-600">{contact.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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

      {showUpcomingBirthdays && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-pink-500 to-purple-500 text-white">
              <div className="flex items-center gap-3">
                <Cake className="w-6 h-6" />
                <h2 className="text-xl font-bold">Upcoming Birthdays (Next 5 Days)</h2>
              </div>
              <button
                onClick={() => setShowUpcomingBirthdays(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {upcomingBirthdays.length === 0 ? (
                <div className="text-center py-12">
                  <Cake className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 text-lg">No upcoming birthdays in the next 5 days</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingBirthdays.map((contact) => {
                    const Icon = typeIcons[contact.type as keyof typeof typeIcons];

                    // Parse birthday correctly to avoid timezone issues
                    const [year, month, day] = contact.birthday!.split('-').map(Number);
                    const birthdayDate = new Date(year, month - 1, day);
                    const today = getESTToday();

                    let daysUntil = 0;
                    for (let i = 0; i <= 5; i++) {
                      const checkDate = new Date(today);
                      checkDate.setDate(today.getDate() + i);
                      if (
                        birthdayDate.getMonth() === checkDate.getMonth() &&
                        birthdayDate.getDate() === checkDate.getDate()
                      ) {
                        daysUntil = i;
                        break;
                      }
                    }

                    const getDaysLabel = (days: number) => {
                      if (days === 0) return 'Today';
                      if (days === 1) return 'Tomorrow';
                      return `In ${days} days`;
                    };

                    const formattedDate = birthdayDate.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric'
                    });

                    return (
                      <div
                        key={contact.id}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          daysUntil === 0
                            ? 'border-pink-500 bg-pink-50'
                            : daysUntil === 1
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`rounded-lg p-2 ${
                            daysUntil === 0
                              ? 'bg-pink-100'
                              : daysUntil === 1
                              ? 'bg-purple-100'
                              : 'bg-slate-100'
                          }`}>
                            <Icon className={`w-5 h-5 ${
                              daysUntil === 0
                                ? 'text-pink-600'
                                : daysUntil === 1
                                ? 'text-purple-600'
                                : 'text-slate-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-semibold text-slate-900">{contact.name}</h3>
                              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                daysUntil === 0
                                  ? 'bg-pink-500 text-white'
                                  : daysUntil === 1
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {getDaysLabel(daysUntil)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                                {typeLabels[contact.type as keyof typeof typeLabels]}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Cake className="w-4 h-4" />
                                {formattedDate}
                              </span>
                            </div>
                            {contact.company && (
                              <div className="mt-1 text-sm text-slate-600">
                                {contact.company}
                              </div>
                            )}
                            {contact.email && (
                              <div className="mt-1 text-sm text-slate-600">
                                {contact.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
