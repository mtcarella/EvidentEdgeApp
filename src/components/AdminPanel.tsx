import { useState, useEffect } from 'react';
import { Database, RefreshCw, Trash2, CreditCard as Edit2, Save, X, Shield, User, Download, Key, UserX, Search, CheckSquare, Square, Users, ArrowUpDown, ArrowUp, ArrowDown, Eye, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatContactData } from '../lib/formatters';
import { ContactEditModal } from './ContactEditModal';
import { ContactView } from './ContactView';
import * as XLSX from 'xlsx';

interface Contact {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  branch: string | null;
  address: string | null;
  paralegal: string | null;
  preferred_surveyor: string | null;
  preferred_uw: string | null;
  preferred_closer: string | null;
  birthday: string | null;
  drinks: boolean | null;
  notes: string | null;
  processor_notes: string | null;
  assigned_to: string | null;
  client_type: string | null;
  grade: string | null;
  assignments?: {
    salesperson_id: string;
    sales_person: {
      name: string;
    };
  }[];
  created_at: string;
}

interface SalesPerson {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

type ViewMode = 'contacts' | 'salespeople' | 'assignments';

type SortField = 'name' | 'type' | 'email' | 'phone' | 'company' | 'salesperson';
type SortDirection = 'asc' | 'desc' | null;

export function AdminPanel() {
  const { isAdminOrProcessor, isAdmin } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('contacts');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [batchAssignMode, setBatchAssignMode] = useState(false);
  const [batchSalespersonId, setBatchSalespersonId] = useState<string>('');
  const [batchParalegalId, setBatchParalegalId] = useState<string>('');
  const [batchClientType, setBatchClientType] = useState<string>('');
  const [batchBranch, setBatchBranch] = useState<string>('');
  const [batchGrade, setBatchGrade] = useState<string>('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [viewingContactId, setViewingContactId] = useState<string | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'salesperson' as string,
  });

  useEffect(() => {
    loadData();
    loadSalesPeopleList();
  }, [viewMode]);

  const loadSalesPeopleList = async () => {
    const { data } = await supabase
      .from('sales_people')
      .select('id, name, user_id')
      .order('name');
    setSalesPeople(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (viewMode === 'contacts') {
        const { data } = await supabase
          .from('contacts')
          .select('*, assignments(salesperson_id, sales_person:sales_people(name))')
          .order('created_at', { ascending: false });
        setContacts(data || []);
      } else if (viewMode === 'salespeople') {
        const { data } = await supabase
          .from('sales_people')
          .select('*')
          .order('name');
        setSalesPeople(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({ ...item });
    console.log('Starting edit with item:', item);
    console.log('Edit form set to:', { ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      if (viewMode === 'contacts') {
        const formattedData = formatContactData({
          name: editForm.name,
          type: editForm.type,
          email: editForm.email,
          phone: editForm.phone,
          company: editForm.company,
          branch: editForm.branch,
          address: editForm.address,
          paralegal: editForm.paralegal || null,
          preferred_surveyor: editForm.preferred_surveyor || null,
          preferred_uw: editForm.preferred_uw || null,
          preferred_closer: editForm.preferred_closer || null,
          birthday: editForm.birthday || null,
          drinks: editForm.drinks ?? null,
          notes: editForm.notes,
          processor_notes: editForm.processor_notes || null,
          client_type: editForm.client_type || null,
          grade: editForm.grade || null,
        });

        const { data, error } = await supabase
          .from('contacts')
          .update({
            ...formattedData,
            assigned_to: editForm.newSalespersonId !== undefined ? (editForm.newSalespersonId || null) : undefined,
          })
          .eq('id', editingId)
          .select();

        if (error) {
          console.error('Error updating contact:', error);
          alert(`Failed to update contact: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.error('No rows updated - possibly due to RLS policy restriction');
          alert('Failed to update: You may not have permission to modify this contact.');
          return;
        }

        console.log('Successfully updated contact:', data);

        if (editForm.newSalespersonId !== undefined) {
          const { data: existingAssignment } = await supabase
            .from('assignments')
            .select('id')
            .eq('contact_id', editingId)
            .maybeSingle();

          const currentUserId = (await supabase.auth.getUser()).data.user?.id;

          if (editForm.newSalespersonId) {
            if (existingAssignment) {
              await supabase
                .from('assignments')
                .update({
                  salesperson_id: editForm.newSalespersonId,
                  assigned_by: currentUserId
                })
                .eq('contact_id', editingId);
            } else {
              await supabase
                .from('assignments')
                .insert({
                  contact_id: editingId,
                  salesperson_id: editForm.newSalespersonId,
                  assigned_by: currentUserId
                });
            }
          } else if (existingAssignment) {
            await supabase
              .from('assignments')
              .delete()
              .eq('contact_id', editingId);
          }
        }
      } else if (viewMode === 'salespeople') {
        const updateData = {
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          is_active: editForm.is_active,
        };

        console.log('Updating salesperson with data:', updateData);
        console.log('Editing ID:', editingId);
        console.log('Full editForm:', editForm);

        const { data, error } = await supabase
          .from('sales_people')
          .update(updateData)
          .eq('id', editingId)
          .select();

        if (error) {
          console.error('Error updating salesperson:', error);
          alert(`Failed to update: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.error('No rows updated - possibly due to RLS policy restriction');
          alert('Failed to update: You may not have permission to modify this user.');
          return;
        }

        console.log('Successfully updated salesperson:', data);
      }

      cancelEdit();
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      alert(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteItem = async (id: string) => {
    if (viewMode === 'contacts') {
      if (!window.confirm('Are you sure you want to delete this contact?')) return;
      try {
        setLoading(true);
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) throw error;
        alert('Contact deleted successfully');
        loadData();
      } catch (error) {
        console.error('Error deleting contact:', error);
        alert(`Failed to delete contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    } else if (viewMode === 'salespeople') {
      if (!window.confirm('Are you sure you want to deactivate this user? They will no longer be able to log in.')) return;
      try {
        setLoading(true);
        const person = salesPeople.find(p => p.id === id);
        if (!person?.user_id) {
          const { error } = await supabase.from('sales_people').delete().eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('sales_people')
            .update({ is_active: false })
            .eq('id', id);
          if (error) throw error;
        }
        alert('User deactivated successfully');
        loadData();
      } catch (error) {
        console.error('Error deactivating user:', error);
        alert(`Failed to deactivate user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const permanentlyDeleteUser = async (id: string) => {
    const person = salesPeople.find(p => p.id === id);
    if (!person?.user_id) {
      alert('This user has no auth account to delete');
      return;
    }

    if (!window.confirm('Are you sure you want to PERMANENTLY delete this user? This cannot be undone and will allow the email to be reused.')) return;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId: person.user_id }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete user');

      alert('User permanently deleted successfully');
      loadData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(`Failed to delete user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (id: string) => {
    const person = salesPeople.find(p => p.id === id);
    if (!person?.user_id) {
      alert('This user has no auth account');
      return;
    }

    const newPassword = prompt('Enter new password (minimum 6 characters):');
    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      console.log('Resetting password for user:', person.user_id);
      console.log('Password length:', newPassword.length);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId: person.user_id, newPassword }),
        }
      );

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response result:', result);

      if (!response.ok) throw new Error(result.error || 'Failed to reset password');

      alert('Password reset successfully');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      alert(`Failed to reset password: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addNewUser = async () => {
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      alert('Please fill in all fields');
      return;
    }

    if (newUserForm.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            name: newUserForm.name,
            email: newUserForm.email,
            password: newUserForm.password,
            role: newUserForm.role,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create user');

      alert('User created successfully');
      setShowAddUserForm(false);
      setNewUserForm({
        name: '',
        email: '',
        password: '',
        role: 'salesperson',
      });
      loadData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(`Failed to create user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleContactSelection = (contactId: string) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContacts(newSelection);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 opacity-30" />;
    }
    return sortDirection === 'asc' ?
      <ArrowUp className="w-4 h-4" /> :
      <ArrowDown className="w-4 h-4" />;
  };

  const toggleAllContacts = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const startBatchAssign = () => {
    if (selectedContacts.size === 0) {
      alert('Please select at least one contact');
      return;
    }
    setBatchAssignMode(true);
  };

  const cancelBatchAssign = () => {
    setBatchAssignMode(false);
    setBatchSalespersonId('');
    setBatchParalegalId('');
    setBatchClientType('');
    setBatchBranch('');
    setBatchGrade('');
  };

  const batchDeleteContacts = async () => {
    if (selectedContacts.size === 0) {
      alert('Please select at least one contact');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedContacts.size} contact(s)? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      for (const contactId of Array.from(selectedContacts)) {
        await supabase.from('contacts').delete().eq('id', contactId);
      }

      alert(`Successfully deleted ${selectedContacts.size} contact(s)`);
      setSelectedContacts(new Set());
      loadData();
    } catch (error) {
      console.error('Error deleting contacts:', error);
      alert('Failed to delete contacts');
    } finally {
      setLoading(false);
    }
  };

  const applyBatchAssign = async () => {
    if (!batchSalespersonId && !batchParalegalId && !batchClientType && !batchBranch && !batchGrade) {
      alert('Please select at least one field to update');
      return;
    }

    setLoading(true);
    try {
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;

      for (const contactId of Array.from(selectedContacts)) {
        const updateData: any = {};

        if (batchSalespersonId) {
          updateData.assigned_to = batchSalespersonId;
        }

        if (batchParalegalId) {
          updateData.paralegal = batchParalegalId || null;
        }

        if (batchClientType) {
          updateData.client_type = batchClientType;
        }

        if (batchBranch) {
          updateData.branch = batchBranch;
        }

        if (batchGrade) {
          updateData.grade = batchGrade;
        }

        await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', contactId);

        if (batchSalespersonId) {
          const { data: existingAssignment } = await supabase
            .from('assignments')
            .select('id')
            .eq('contact_id', contactId)
            .maybeSingle();

          if (existingAssignment) {
            await supabase
              .from('assignments')
              .update({ salesperson_id: batchSalespersonId })
              .eq('contact_id', contactId);
          } else {
            await supabase
              .from('assignments')
              .insert({
                contact_id: contactId,
                salesperson_id: batchSalespersonId,
                assigned_by: currentUserId
              });
          }
        }
      }

      alert(`Successfully updated ${selectedContacts.size} contact(s)`);
      setSelectedContacts(new Set());
      setBatchAssignMode(false);
      setBatchSalespersonId('');
      setBatchParalegalId('');
      setBatchClientType('');
      setBatchBranch('');
      setBatchGrade('');
      loadData();
    } catch (error) {
      console.error('Error applying batch assignment:', error);
      alert('Failed to assign contacts');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.phone?.toLowerCase().includes(query) ||
      contact.company?.toLowerCase().includes(query) ||
      contact.type.toLowerCase().includes(query) ||
      contact.assignments?.[0]?.sales_person?.name.toLowerCase().includes(query)
    );
  });

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;

    let aValue: string = '';
    let bValue: string = '';

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
      case 'salesperson':
        aValue = a.assignments?.[0]?.sales_person?.name || '';
        bValue = b.assignments?.[0]?.sales_person?.name || '';
        break;
    }

    const comparison = aValue.localeCompare(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const exportToCSV = async () => {
    try {
      let filename = '';

      if (viewMode === 'contacts') {
        if (selectedContacts.size === 0) {
          alert('Please select at least one contact to export');
          return;
        }

        setLoading(true);

        const contactIds = Array.from(selectedContacts);
        const { data: contacts } = await supabase
          .from('contacts')
          .select('*, assignments(salesperson_id, sales_person:sales_people(name))')
          .in('id', contactIds)
          .order('created_at', { ascending: false });

        if (!contacts || contacts.length === 0) {
          alert('No data to export');
          setLoading(false);
          return;
        }

        const { data: meetings } = await supabase
          .from('meetings')
          .select('*, contact_id')
          .in('contact_id', contactIds)
          .order('meeting_date', { ascending: false });

        const meetingsByContact = new Map<string, any[]>();
        meetings?.forEach(meeting => {
          const contactId = meeting.contact_id;
          if (!meetingsByContact.has(contactId)) {
            meetingsByContact.set(contactId, []);
          }
          meetingsByContact.get(contactId)?.push(meeting);
        });

        const worksheetData = contacts.map((contact: any) => {
          const contactMeetings = meetingsByContact.get(contact.id) || [];
          const meetingsText = contactMeetings
            .map(m => `${m.meeting_date}: ${m.notes}`)
            .join(' | ');

          return {
            'Name': contact.name || '',
            'Type': contact.type || '',
            'Email': contact.email || '',
            'Phone': contact.phone || '',
            'Company': contact.company || '',
            'Branch': contact.branch || '',
            'Address': contact.address || '',
            'Paralegal': contact.paralegal || '',
            'Assigned To': contact.assignments?.[0]?.sales_person?.name || 'Unassigned',
            'Notes': contact.notes || '',
            'Meetings': meetingsText,
            'Created At': new Date(contact.created_at).toLocaleString(),
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

        filename = `contacts_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, filename);
        setLoading(false);
      } else if (viewMode === 'salespeople') {
        const { data } = await supabase
          .from('sales_people')
          .select('*')
          .order('name');

        if (!data || data.length === 0) {
          alert('No data to export');
          return;
        }

        const worksheetData = data.map((person: any) => ({
          'Name': person.name || '',
          'Email': person.email || '',
          'Role': person.role || '',
          'Active': person.is_active ? 'Yes' : 'No',
          'Created At': new Date(person.created_at).toLocaleString(),
        }));

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Salespeople');

        filename = `salespeople_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, filename);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting data');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-6 h-6 text-amber-600" />
        <h2 className="text-2xl font-bold text-slate-900">Admin Database Management</h2>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode('contacts')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'contacts'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Contacts
        </button>
        <button
          onClick={() => setViewMode('salespeople')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'salespeople'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Users
        </button>
        {viewMode === 'salespeople' && (
          <button
            onClick={() => setShowAddUserForm(!showAddUserForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add New User
          </button>
        )}
        <button
          onClick={exportToCSV}
          disabled={loading}
          className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {viewMode === 'contacts' && (
        <div>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search contacts by name, email, phone, company, type, or salesperson..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm text-slate-600">
                Found {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {batchAssignMode ? (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-slate-900">
                    {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <select
                    value={batchSalespersonId}
                    onChange={(e) => setBatchSalespersonId(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Salesperson (Optional)</option>
                    {salesPeople.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={batchParalegalId}
                    onChange={(e) => setBatchParalegalId(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Paralegal (Optional)</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Lisa">Lisa</option>
                    <option value="Raphael">Raphael</option>
                    <option value="Danielle">Danielle</option>
                  </select>
                  <select
                    value={batchClientType}
                    onChange={(e) => setBatchClientType(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Client Type (Optional)</option>
                    <option value="client">Client</option>
                    <option value="prospect">Prospect</option>
                  </select>
                  <select
                    value={batchBranch}
                    onChange={(e) => setBatchBranch(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Branch (Optional)</option>
                    <option value="None">None</option>
                    <option value="ETA 1">ETA 1</option>
                    <option value="ETA 2">ETA 2</option>
                    <option value="ETA 3">ETA 3</option>
                  </select>
                  <select
                    value={batchGrade}
                    onChange={(e) => setBatchGrade(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Grade (Optional)</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={applyBatchAssign}
                    disabled={loading || (!batchSalespersonId && !batchParalegalId && !batchClientType && !batchBranch && !batchGrade)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Apply
                  </button>
                  <button
                    onClick={cancelBatchAssign}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex gap-2">
              <button
                onClick={startBatchAssign}
                disabled={selectedContacts.size === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:bg-slate-300 flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Batch Assign ({selectedContacts.size})
              </button>
              <button
                onClick={batchDeleteContacts}
                disabled={selectedContacts.size === 0}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:bg-slate-300 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Batch Delete ({selectedContacts.size})
              </button>
              {selectedContacts.size > 0 && (
                <button
                  onClick={() => setSelectedContacts(new Set())}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                >
                  Clear Selection
                </button>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 w-12">
                    <button
                      onClick={toggleAllContacts}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      {selectedContacts.size === sortedContacts.length && sortedContacts.length > 0 ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Name {getSortIcon('name')}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    <button
                      onClick={() => handleSort('type')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Type {getSortIcon('type')}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    <button
                      onClick={() => handleSort('email')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Email {getSortIcon('email')}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    <button
                      onClick={() => handleSort('phone')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Phone {getSortIcon('phone')}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    <button
                      onClick={() => handleSort('company')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Company {getSortIcon('company')}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Paralegal</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    <button
                      onClick={() => handleSort('salesperson')}
                      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                    >
                      Salesperson {getSortIcon('salesperson')}
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedContacts.map((contact) => (
                <tr key={contact.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {editingId === contact.id ? (
                    <>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        >
                          <option value="buyer">Buyer</option>
                          <option value="realtor">Realtor</option>
                          <option value="attorney">Attorney</option>
                          <option value="lender">Lender</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="email"
                          value={editForm.email || ''}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={editForm.phone || ''}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={editForm.company || ''}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={editForm.paralegal || ''}
                          onChange={(e) => setEditForm({ ...editForm, paralegal: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        >
                          <option value="">None</option>
                          <option value="Kristen">Kristen</option>
                          <option value="Lisa">Lisa</option>
                          <option value="Raphael">Raphael</option>
                          <option value="Danielle">Danielle</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={editForm.newSalespersonId ?? (editForm.assignments?.[0]?.salesperson_id || '')}
                          onChange={(e) => setEditForm({ ...editForm, newSalespersonId: e.target.value || null })}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        >
                          <option value="">Unassigned</option>
                          {salesPeople.map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              {sp.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={saveEdit}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleContactSelection(contact.id)}
                          className="p-1 hover:bg-slate-100 rounded"
                        >
                          {selectedContacts.has(contact.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{contact.name}</td>
                      <td className="py-3 px-4 text-slate-600 capitalize">{contact.type}</td>
                      <td className="py-3 px-4 text-slate-600">{contact.email || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">{contact.phone || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">{contact.company || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">{contact.paralegal || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {contact.assignments?.[0]?.sales_person?.name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewingContactId(contact.id)}
                            className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                            title="View Contact"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingContact(contact)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit Contact"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteItem(contact.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Delete Contact"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                ))}
              </tbody>
            </table>
            {sortedContacts.length === 0 && !loading && (
              <div className="text-center py-12 text-slate-500">
                {searchQuery ? 'No contacts match your search' : 'No contacts found'}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'salespeople' && (
        <div className="space-y-4">
          {showAddUserForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New User</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="salesperson">Salesperson</option>
                    <option value="closer">Closer</option>
                    <option value="processor">Processor</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={addNewUser}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Create User
                </button>
                <button
                  onClick={() => {
                    setShowAddUserForm(false);
                    setNewUserForm({ name: '', email: '', password: '', role: 'salesperson' });
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Show in Dropdown</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesPeople.map((person) => (
                <tr key={person.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {editingId === person.id ? (
                    <>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={editForm.role || 'salesperson'}
                          onChange={(e) => {
                            const newRole = e.target.value;
                            console.log('Role changed to:', newRole);
                            setEditForm({ ...editForm, role: newRole });
                          }}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        >
                          <option value="salesperson">Salesperson</option>
                          <option value="closer">Closer</option>
                          <option value="processor">Processor</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-600 text-sm">
                          {person.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={editForm.is_active ? 'yes' : 'no'}
                          onChange={(e) =>
                            setEditForm({ ...editForm, is_active: e.target.value === 'yes' })
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={saveEdit}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4 font-medium text-slate-900">{person.name}</td>
                      <td className="py-3 px-4 text-slate-600">{person.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            person.role === 'super_admin'
                              ? 'bg-purple-100 text-purple-800'
                              : person.role === 'admin'
                              ? 'bg-amber-100 text-amber-800'
                              : person.role === 'processor'
                              ? 'bg-blue-100 text-blue-800'
                              : person.role === 'closer'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {person.role === 'admin' || person.role === 'super_admin' ? (
                            <Shield className="w-3 h-3" />
                          ) : (
                            <User className="w-3 h-3" />
                          )}
                          {person.role === 'super_admin' ? 'Super Admin' : person.role === 'admin' ? 'Admin' : person.role === 'processor' ? 'Processor' : person.role === 'closer' ? 'Closer' : 'Salesperson'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-600 text-sm">Active</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            person.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {person.is_active ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(person)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit user"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {person.user_id && (
                            <button
                              onClick={() => resetPassword(person.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Reset password"
                              disabled={loading}
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteItem(person.id)}
                            className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                            title={person.user_id ? "Deactivate user" : "Delete user record"}
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => permanentlyDeleteUser(person.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Permanently delete user"
                            disabled={loading}
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {salesPeople.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-500">No sales people found</div>
          )}
          </div>
        </div>
      )}

      {editingContact && (
        <ContactEditModal
          contact={editingContact}
          salesPeople={salesPeople}
          isAdminOrProcessor={isAdminOrProcessor}
          isAdmin={isAdmin}
          onSave={() => {
            setEditingContact(null);
            loadData();
          }}
          onCancel={() => setEditingContact(null)}
        />
      )}

      {viewingContactId && (
        <ContactView
          contactId={viewingContactId}
          onClose={() => setViewingContactId(null)}
        />
      )}
    </div>
  );
}
