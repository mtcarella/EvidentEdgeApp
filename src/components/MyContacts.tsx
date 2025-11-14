import { useState, useEffect } from 'react';
import { User, Users, Briefcase, Scale, Edit2, X, Save, Loader, ArrowUpDown, ArrowUp, ArrowDown, Search, Eye, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ContactView } from './ContactView';
import { formatContactData } from '../lib/formatters';
import { ContactEditModal } from './ContactEditModal';
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
  notes?: string;
  processor_notes?: string;
  created_at: string;
}

const typeIcons = {
  buyer: User,
  realtor: Users,
  lender: Briefcase,
  attorney: Scale,
};

const typeLabels = {
  buyer: 'Buyer',
  realtor: 'Realtor',
  lender: 'Lender',
  attorney: 'Attorney',
};

export function MyContacts() {
  const { salesPerson, isAdminOrProcessor, isAdmin } = useAuth();
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
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          assignments!inner (
            salesperson_id
          )
        `)
        .eq('assignments.salesperson_id', salesPerson.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          company: editForm.company,
          branch: editForm.branch,
          address: editForm.address,
          notes: editForm.notes,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', contactId);

      if (error) throw error;

      setContacts(prevContacts =>
        prevContacts.map(c =>
          c.id === contactId
            ? { ...c, ...editForm as Partial<Contact> }
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
        'Company': contact.company || '',
        'Branch': contact.branch || '',
        'Address': contact.address || '',
        'Birthday': contact.birthday ? new Date(contact.birthday).toLocaleDateString('en-US') : '',
        'Drinks': contact.drinks ? 'Yes' : 'No',
        'Notes': contact.notes || '',
        'Created At': new Date(contact.created_at).toLocaleString(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'My Contacts');

      XLSX.writeFile(workbook, `my_contacts_${new Date().toISOString().split('T')[0]}.xlsx`);
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
    filteredContacts = filteredContacts.filter(contact =>
      contact.name.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.phone?.toLowerCase().includes(query) ||
      contact.company?.toLowerCase().includes(query) ||
      contact.branch?.toLowerCase().includes(query) ||
      contact.address?.toLowerCase().includes(query) ||
      contact.notes?.toLowerCase().includes(query)
    );
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
    lender: contacts.filter(c => c.type === 'lender').length,
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
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-slate-900">My Contacts</h2>
          <button
            onClick={exportMyContacts}
            disabled={exportLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {exportLoading ? 'Exporting...' : 'Export My Contacts'}
          </button>
        </div>
        <p className="text-sm text-slate-600">View and edit all contacts assigned to you</p>
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

      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Sort by:</span>
          <button
            onClick={() => handleSort('name')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
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
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
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
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
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
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
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
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
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
        <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterType === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All ({contactCounts.all})
        </button>
        <button
          onClick={() => setFilterType('buyer')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterType === 'buyer'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Buyers ({contactCounts.buyer})
        </button>
        <button
          onClick={() => setFilterType('realtor')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterType === 'realtor'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Realtors ({contactCounts.realtor})
        </button>
        <button
          onClick={() => setFilterType('attorney')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterType === 'attorney'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Attorneys ({contactCounts.attorney})
        </button>
        <button
          onClick={() => setFilterType('lender')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            filterType === 'lender'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Lenders ({contactCounts.lender})
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
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={editForm.email || ''}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editForm.phone || ''}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                        <input
                          type="text"
                          value={editForm.company || ''}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Branch</label>
                        <input
                          type="text"
                          value={editForm.branch || ''}
                          onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                        <input
                          type="text"
                          value={editForm.address || ''}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                        <textarea
                          value={editForm.notes || ''}
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
          contact={editingContact}
          salesPeople={salesPeople}
          isAdminOrProcessor={isAdminOrProcessor}
          isAdmin={isAdmin}
          onSave={() => {
            setEditingContact(null);
            loadContacts();
          }}
          onCancel={() => setEditingContact(null)}
        />
      )}
    </div>
  );
}
