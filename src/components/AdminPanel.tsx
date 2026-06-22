import { useState, useEffect } from 'react';
import { Database, RefreshCw, Trash2, CreditCard as Edit2, Save, X, Shield, User, Download, Key, UserX, Search, CheckSquare, Square, Users, ArrowUpDown, ArrowUp, ArrowDown, Eye, UserPlus, Copy, Mail, FileText, Settings, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { useModulePermissions } from '../hooks/useModulePermissions';
import { SystemSettingsPanel } from './SystemSettingsPanel';
import { formatContactData } from '../lib/formatters';
import { ContactEditModal } from './ContactEditModal';
import { ContactView } from './ContactView';
import { ModulePermissionsManager } from './ModulePermissionsManager';
import { UserEditPanel } from './UserEditPanel';
import { findAllDuplicates, DuplicateGroup } from '../lib/duplicateChecker';
import { expandSearchTermWithNicknames } from '../lib/nicknameMapper';
import * as XLSX from 'xlsx';
import { getTodayDateString } from '../lib/dateUtils';

interface Contact {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  cell_phone: string | null;
  company: string | null;
  branch: string | null;
  address: string | null;
  evident_paralegal: string | null;
  client_paralegal_processor: string | null;
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
  birthday?: string | null;
  requires_daily_reports?: boolean;
  requires_weekly_reports?: boolean;
  chat_enabled?: boolean;
  friends_family_enabled?: boolean;
  file_viewer_enabled?: boolean;
}

type ViewMode = 'contacts' | 'salespeople' | 'assignments' | 'module_permissions' | 'system_settings';

type SortField = 'name' | 'type' | 'email' | 'phone' | 'company' | 'salesperson' | 'evident_paralegal';
type SortDirection = 'asc' | 'desc' | null;
type UserSortField = 'name' | 'email' | 'role' | 'is_active';

export function AdminPanel() {
  const { isAdminOrProcessor, isAdmin, isSuperAdmin, user, salesPersonId } = useAuth();
  const { hasAccess } = useModulePermissions(user?.id, salesPersonId);
  const dialog = useDialog();
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
  const [sortField, setSortField] = useState<SortField | null>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [userSortField, setUserSortField] = useState<UserSortField | null>('name');
  const [userSortDirection, setUserSortDirection] = useState<SortDirection>('asc');
  const [viewingContactId, setViewingContactId] = useState<string | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    cell_phone: '',
    password: '',
    role: 'salesperson' as string,
  });
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [searchingDuplicates, setSearchingDuplicates] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [filterBySalesperson, setFilterBySalesperson] = useState<string>('');
  const [filterByType, setFilterByType] = useState<string>('');
  const [filterByEvidentParalegal, setFilterByEvidentParalegal] = useState<string>('');
  const [testEmailStatus, setTestEmailStatus] = useState<string>('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  useEffect(() => {
    if (viewMode === 'salespeople') {
      loadData();
    } else if (viewMode === 'contacts') {
      loadData();
      loadSalesPeopleList();
    }
  }, [viewMode]);

  const loadSalesPeopleList = async () => {
    const { data } = await supabase
      .from('sales_people')
      .select('id, name, user_id')
      .order('name');
    setSalesPeople(data || []);
  };

  const sendTestEmail = async () => {
    setSendingTestEmail(true);
    setTestEmailStatus('Sending test email...');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-report-reminders?test=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTestEmailStatus(`SUCCESS: Test email sent to ${result.recipient} (Email ID: ${result.emailId})`);
      } else {
        setTestEmailStatus(`ERROR: ${result.error || 'Failed to send email. Check if RESEND_API_KEY is configured in Supabase.'}`);
      }
    } catch (error: any) {
      setTestEmailStatus(`✗ Error: ${error.message}`);
    } finally {
      setSendingTestEmail(false);
      setTimeout(() => setTestEmailStatus(''), 10000);
    }
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
    if (viewMode === 'salespeople') {
      setEditingId(item.id);
      setEditForm({ ...item });
    } else {
      setEditingId(item.id);
      setEditForm({ ...item });
      console.log('Starting edit with item:', item);
      console.log('Edit form set to:', { ...item });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    if (viewMode === 'salespeople') {
      loadData();
    }
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
          evident_paralegal: editForm.evident_paralegal || null,
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
          await dialog.alert(`Failed to update contact: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.error('No rows updated - possibly due to RLS policy restriction');
          await dialog.alert('Failed to update: You may not have permission to modify this contact.');
          return;
        }

        console.log('Successfully updated contact:', data);

        if (editForm.newSalespersonId !== undefined) {
          const { data: existingAssignment } = await supabase
            .from('assignments')
            .select('id')
            .eq('contact_id', editingId)
            .maybeSingle();

          const currentUserId = user?.id;

          if (editForm.newSalespersonId) {
            if (existingAssignment) {
              const { error: updateError } = await supabase
                .from('assignments')
                .update({
                  salesperson_id: editForm.newSalespersonId,
                  assigned_by: currentUserId
                })
                .eq('contact_id', editingId);

              if (updateError) {
                console.error('Error updating assignment:', updateError);
                await dialog.alert(`Failed to update assignment: ${updateError.message}`);
                return;
              }
            } else {
              const { error: insertError } = await supabase
                .from('assignments')
                .insert({
                  contact_id: editingId,
                  salesperson_id: editForm.newSalespersonId,
                  assigned_by: currentUserId
                });

              if (insertError) {
                console.error('Error creating assignment:', insertError);
                await dialog.alert(`Failed to create assignment: ${insertError.message}`);
                return;
              }
            }
          } else if (existingAssignment) {
            const { error: deleteError } = await supabase
              .from('assignments')
              .delete()
              .eq('contact_id', editingId);

            if (deleteError) {
              console.error('Error deleting assignment:', deleteError);
              await dialog.alert(`Failed to delete assignment: ${deleteError.message}`);
              return;
            }
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
          await dialog.alert(`Failed to update: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.error('No rows updated - possibly due to RLS policy restriction');
          await dialog.alert('Failed to update: You may not have permission to modify this user.');
          return;
        }

        console.log('Successfully updated salesperson:', data);
      }

      cancelEdit();
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      await dialog.alert(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteItem = async (id: string) => {
    if (viewMode === 'contacts') {
      if (!(await dialog.confirm('Are you sure you want to delete this contact?'))) return;
      try {
        setLoading(true);
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) throw error;
        await dialog.alert('Contact deleted successfully');
        loadData();
      } catch (error) {
        console.error('Error deleting contact:', error);
        await dialog.alert(`Failed to delete contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    } else if (viewMode === 'salespeople') {
      if (!(await dialog.confirm('Are you sure you want to deactivate this user? They will no longer be able to log in.'))) return;
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
        await dialog.alert('User deactivated successfully');
        loadData();
      } catch (error) {
        console.error('Error deactivating user:', error);
        await dialog.alert(`Failed to deactivate user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const permanentlyDeleteUser = async (id: string) => {
    const person = salesPeople.find(p => p.id === id);
    if (!person?.user_id) {
      await dialog.alert('This user has no auth account to delete');
      return;
    }

    if (!(await dialog.confirm('Are you sure you want to PERMANENTLY delete this user? This cannot be undone and will allow the email to be reused.'))) return;

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

      await dialog.alert('User permanently deleted successfully');
      loadData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      await dialog.alert(`Failed to delete user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (id: string) => {
    const person = salesPeople.find(p => p.id === id);
    if (!person?.user_id) {
      await dialog.alert('This user has no auth account');
      return;
    }

    const newPassword = await dialog.prompt('Enter new password (minimum 6 characters):', '');
    if (!newPassword) return;

    if (newPassword.length < 6) {
      await dialog.alert('Password must be at least 6 characters');
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

      await dialog.alert('Password reset successfully');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      await dialog.alert(`Failed to reset password: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const impersonateUser = async (person: SalesPerson) => {
    if (!person.user_id) {
      await dialog.alert('This user has no auth account and cannot be impersonated.');
      return;
    }

    const masterPassword = await dialog.prompt(
      `Enter the impersonation master password to log in as ${person.name} (${person.email}).`,
      '',
      { title: 'Log in as user' }
    );
    if (!masterPassword) return;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/master-password-auth`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email: person.email, password: masterPassword }),
        }
      );

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to start impersonation');

      if (!result.isMasterPassword || !result.session) {
        await dialog.alert('Invalid master password.');
        return;
      }

      const { error: setErr } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (setErr) throw setErr;

      window.location.href = '/';
    } catch (error: any) {
      console.error('Error impersonating user:', error);
      await dialog.alert(`Failed to log in as user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addNewUser = async () => {
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      await dialog.alert('Please fill in all fields');
      return;
    }

    if (newUserForm.password.length < 6) {
      await dialog.alert('Password must be at least 6 characters');
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
            cell_phone: newUserForm.cell_phone || null,
            password: newUserForm.password,
            role: newUserForm.role,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create user');

      await dialog.alert('User created successfully');
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
      await dialog.alert(`Failed to create user: ${error.message}`);
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
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleUserSort = (field: UserSortField) => {
    if (userSortField === field) {
      setUserSortDirection(userSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSortField(field);
      setUserSortDirection('asc');
    }
  };

  const toggleAllContacts = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const startBatchAssign = async () => {
    if (selectedContacts.size === 0) {
      await dialog.alert('Please select at least one contact');
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
      await dialog.alert('Please select at least one contact');
      return;
    }

    if (!(await dialog.confirm(`Are you sure you want to delete ${selectedContacts.size} contact(s)? This action cannot be undone.`))) {
      return;
    }

    setLoading(true);
    try {
      for (const contactId of Array.from(selectedContacts)) {
        await supabase.from('contacts').delete().eq('id', contactId);
      }

      await dialog.alert(`Successfully deleted ${selectedContacts.size} contact(s)`);
      setSelectedContacts(new Set());
      loadData();
    } catch (error) {
      console.error('Error deleting contacts:', error);
      await dialog.alert('Failed to delete contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateSearch = async () => {
    setSearchingDuplicates(true);
    setShowDuplicates(true);
    try {
      const groups = await findAllDuplicates();
      setDuplicateGroups(groups);
    } catch (error) {
      console.error('Error finding duplicates:', error);
      await dialog.alert('Failed to search for duplicates');
    } finally {
      setSearchingDuplicates(false);
    }
  };

  const closeDuplicateSearch = () => {
    setShowDuplicates(false);
    setDuplicateGroups([]);
  };

  const applyBatchAssign = async () => {
    if (!batchSalespersonId && !batchParalegalId && !batchClientType && !batchBranch && !batchGrade) {
      await dialog.alert('Please select at least one field to update');
      return;
    }

    setLoading(true);
    try {
      const currentUserId = user?.id;

      for (const contactId of Array.from(selectedContacts)) {
        const updateData: any = {};

        if (batchSalespersonId) {
          updateData.assigned_to = batchSalespersonId;
        }

        if (batchParalegalId) {
          updateData.evident_paralegal = batchParalegalId || null;
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

      await dialog.alert(`Successfully updated ${selectedContacts.size} contact(s)`);
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
      await dialog.alert('Failed to assign contacts');
    } finally {
      setLoading(false);
    }
  };

  const reformatSelectedContacts = async () => {
    if (selectedContacts.size === 0) {
      await dialog.alert('Please select at least one contact to format');
      return;
    }

    if (!(await dialog.confirm(`This will reformat phone numbers and addresses for ${selectedContacts.size} selected contact(s). Continue?`))) {
      return;
    }

    setLoading(true);
    try {
      const contactIds = Array.from(selectedContacts);
      const { data: contactsToFormat, error: fetchError } = await supabase
        .from('contacts')
        .select('id, phone, cell_phone, address, name, company, preferred_surveyor, preferred_uw, preferred_closer, client_paralegal_processor, evident_paralegal')
        .in('id', contactIds);

      if (fetchError) throw fetchError;

      let updated = 0;
      let failed = 0;

      for (const contact of contactsToFormat || []) {
        try {
          const formattedData = formatContactData({
            phone: contact.phone,
            cell_phone: contact.cell_phone,
            address: contact.address,
            name: contact.name,
            company: contact.company,
            preferred_surveyor: contact.preferred_surveyor,
            preferred_uw: contact.preferred_uw,
            preferred_closer: contact.preferred_closer,
            client_paralegal_processor: contact.client_paralegal_processor,
            evident_paralegal: contact.evident_paralegal,
          });

          console.log(`Formatting contact ${contact.name}:`, {
            before: { name: contact.name, phone: contact.phone, cell_phone: contact.cell_phone },
            after: { name: formattedData.name, phone: formattedData.phone, cell_phone: formattedData.cell_phone }
          });

          const { data: updateData, error: updateError } = await supabase
            .from('contacts')
            .update(formattedData)
            .eq('id', contact.id)
            .select();

          if (updateError) {
            console.error(`Update error for ${contact.name}:`, updateError);
            throw updateError;
          }

          if (!updateData || updateData.length === 0) {
            console.error(`No rows updated for contact ${contact.name} - RLS policy may be blocking`);
            throw new Error('Update blocked by RLS policy');
          }

          updated++;
        } catch (err) {
          console.error(`Failed to update contact ${contact.id}:`, err);
          failed++;
        }
      }

      await dialog.alert(`Formatting complete!\nUpdated: ${updated}\nFailed: ${failed}`);
      loadData();
    } catch (error) {
      console.error('Error reformatting contacts:', error);
      await dialog.alert('Failed to reformat contacts');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    // Filter by salesperson first
    if (filterBySalesperson) {
      const contactSalespersonId = contact.assignments?.[0]?.salesperson_id;
      if (contactSalespersonId !== filterBySalesperson) {
        return false;
      }
    }

    // Filter by type
    if (filterByType) {
      if (contact.type !== filterByType) {
        return false;
      }
    }

    // Filter by evident paralegal
    if (filterByEvidentParalegal) {
      if (contact.evident_paralegal !== filterByEvidentParalegal) {
        return false;
      }
    }

    // Then filter by search query with fuzzy matching
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    // Check non-name fields first (email, phone, company, type, salesperson)
    if (
      contact.email?.toLowerCase().includes(query) ||
      contact.phone?.toLowerCase().includes(query) ||
      contact.company?.toLowerCase().includes(query) ||
      contact.type.toLowerCase().includes(query) ||
      contact.assignments?.[0]?.sales_person?.name.toLowerCase().includes(query)
    ) {
      return true;
    }

    // For name searches, use fuzzy matching with nickname expansion
    const searchVariants = expandSearchTermWithNicknames(searchQuery.trim());
    const contactNameLower = contact.name.toLowerCase();

    for (const variant of searchVariants) {
      const variantLower = variant.toLowerCase();
      // Check if variant matches name (fuzzy)
      if (contactNameLower.includes(variantLower)) {
        return true;
      }
      // Also check if all words in variant are present in contact name
      const variantWords = variantLower.split(/\s+/);
      if (variantWords.every(word => contactNameLower.includes(word))) {
        return true;
      }
    }

    return false;
  });

  const sortedContacts = [...filteredContacts].sort((a, b) => {
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
      case 'evident_paralegal':
        aValue = a.evident_paralegal || '';
        bValue = b.evident_paralegal || '';
        break;
      default:
        return 0;
    }

    const comparison = aValue.localeCompare(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const sortedSalesPeople = [...salesPeople].sort((a, b) => {
    if (!userSortField) return 0;

    switch (userSortField) {
      case 'name':
        const nameComparison = (a.name || '').localeCompare(b.name || '');
        return userSortDirection === 'asc' ? nameComparison : -nameComparison;
      case 'email':
        const emailComparison = (a.email || '').localeCompare(b.email || '');
        return userSortDirection === 'asc' ? emailComparison : -emailComparison;
      case 'role':
        const roleComparison = (a.role || '').localeCompare(b.role || '');
        return userSortDirection === 'asc' ? roleComparison : -roleComparison;
      case 'is_active':
        const activeComparison = (a.is_active === b.is_active) ? 0 : (a.is_active ? -1 : 1);
        return userSortDirection === 'asc' ? activeComparison : -activeComparison;
      default:
        return 0;
    }
  });

  const exportToCSV = async () => {
    try {
      let filename = '';

      if (viewMode === 'contacts') {
        if (selectedContacts.size === 0) {
          await dialog.alert('Please select at least one contact to export');
          return;
        }

        setLoading(true);

        const contactIds = Array.from(selectedContacts);
        const selectedContactsData = contacts.filter(c => selectedContacts.has(c.id));

        if (selectedContactsData.length === 0) {
          await dialog.alert('No data to export');
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

        const worksheetData = selectedContactsData.map((contact: any) => {
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
            'Evident Paralegal': contact.evident_paralegal || '',
            'Assigned To': contact.assignments?.[0]?.sales_person?.name || 'Unassigned',
            'Notes': contact.notes || '',
            'Meetings': meetingsText,
            'Created At': new Date(contact.created_at).toLocaleString(),
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

        filename = `contacts_export_${getTodayDateString()}.xlsx`;
        XLSX.writeFile(workbook, filename);
        setLoading(false);
      } else if (viewMode === 'salespeople') {
        const { data } = await supabase
          .from('sales_people')
          .select('*')
          .order('name');

        if (!data || data.length === 0) {
          await dialog.alert('No data to export');
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

        filename = `salespeople_${getTodayDateString()}.xlsx`;
        XLSX.writeFile(workbook, filename);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      await dialog.alert('Error exporting data');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-6 h-6 text-amber-600" />
        <h2 className="text-2xl font-bold text-slate-900 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Admin Database Management</h2>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setViewMode('contacts');
            setEditingId(null);
            setEditForm({});
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'contacts'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Contacts
        </button>
        <button
          onClick={() => {
            setViewMode('salespeople');
            setEditingId(null);
            setEditForm({});
            setSalesPeople([]);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'salespeople'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Users
        </button>
        {isAdmin && (
          <button
            onClick={() => {
              setViewMode('module_permissions');
              setEditingId(null);
              setEditForm({});
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'module_permissions'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Module Permissions
            </div>
          </button>
        )}
        {isSuperAdmin && (
          <button
            onClick={() => {
              setViewMode('system_settings');
              setEditingId(null);
              setEditForm({});
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'system_settings'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              System Settings
            </div>
          </button>
        )}
        <button
          onClick={sendTestEmail}
          disabled={sendingTestEmail}
          className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Mail className="w-4 h-4" />
          {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
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
        {viewMode === 'contacts' && (
          <button
            onClick={reformatSelectedContacts}
            disabled={loading || selectedContacts.size === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Format ({selectedContacts.size})
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

      {testEmailStatus && (
        <div className={`mb-4 p-4 rounded-lg ${testEmailStatus.startsWith('SUCCESS') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {testEmailStatus}
        </div>
      )}

      {viewMode === 'contacts' && (
        <div>
          <div className="mb-4 space-y-3">
            <div className="flex gap-3 items-center">
              <button
                onClick={toggleAllContacts}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
              >
                {selectedContacts.size === filteredContacts.length && filteredContacts.length > 0 ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
                <span>Check All ({filteredContacts.length})</span>
              </button>
              <select
                value={filterBySalesperson}
                onChange={(e) => setFilterBySalesperson(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Filter by Salesperson: All</option>
                {salesPeople.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
              </select>
              <select
                value={filterByType}
                onChange={(e) => setFilterByType(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Filter by Type: All</option>
                <option value="buyer">Buyer</option>
                <option value="realtor">Realtor</option>
                <option value="loan_officer">Loan Officer</option>
                <option value="attorney">Attorney</option>
                <option value="vendor">Vendor</option>
              </select>
              <select
                value={filterByEvidentParalegal}
                onChange={(e) => setFilterByEvidentParalegal(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Filter by Evident Paralegal: All</option>
                <option value="Kristen">Kristen</option>
                <option value="Lisa">Lisa</option>
                <option value="Raphael">Raphael</option>
                <option value="Danielle">Danielle</option>
              </select>
            </div>
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
            {(searchQuery || filterBySalesperson || filterByType || filterByEvidentParalegal) && (
              <div className="text-sm text-slate-600">
                Found {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className="mb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
            <span className="text-sm font-medium text-slate-700 flex-shrink-0">Sort by:</span>
            <button
              onClick={() => handleSort('name')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
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
            <button
              onClick={() => handleSort('salesperson')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
                sortField === 'salesperson'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Salesperson
              {sortField === 'salesperson' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={() => handleSort('evident_paralegal')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
                sortField === 'evident_paralegal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Evident Paralegal
              {sortField === 'evident_paralegal' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
            </button>
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
                    <option value="">Evident Paralegal (Optional)</option>
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
              <button
                onClick={handleDuplicateSearch}
                disabled={searchingDuplicates}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                {searchingDuplicates ? 'Searching...' : 'Duplicate Search'}
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

          <div className="space-y-3">
            {sortedContacts.length === 0 && !loading && (
              <div className="text-center py-12 text-slate-500">
                {searchQuery ? 'No contacts match your search' : 'No contacts found'}
              </div>
            )}
            {sortedContacts.map((contact) => (
              <div
                key={contact.id}
                className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => toggleContactSelection(contact.id)}
                      className="p-1 hover:bg-slate-100 rounded mt-1"
                    >
                      {selectedContacts.has(contact.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{contact.name}</h3>
                        <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded capitalize">
                          {contact.type}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mb-2">
                        {contact.email && <span>{contact.email}</span>}
                        {contact.email && contact.phone && <span className="mx-2">•</span>}
                        {contact.phone && <span>{contact.phone}</span>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {contact.company && (
                          <div>
                            <span className="font-medium text-slate-700">Company:</span>
                            <span className="ml-2 text-slate-600">{contact.company}</span>
                          </div>
                        )}
                        {contact.branch && (
                          <div>
                            <span className="font-medium text-slate-700">Branch:</span>
                            <span className="ml-2 text-slate-600">{contact.branch}</span>
                          </div>
                        )}
                        {contact.type === 'attorney' && contact.evident_paralegal && (
                          <div>
                            <span className="font-medium text-slate-700">Evident Paralegal:</span>
                            <span className="ml-2 text-slate-600">{contact.evident_paralegal}</span>
                          </div>
                        )}
                        {contact.client_type && (
                          <div>
                            <span className="font-medium text-slate-700">Client Type:</span>
                            <span className="ml-2 text-slate-600 capitalize">{contact.client_type}</span>
                          </div>
                        )}
                        {contact.grade && (
                          <div>
                            <span className="font-medium text-slate-700">Grade:</span>
                            <span className="ml-2 text-slate-600">{contact.grade}</span>
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
                        <div className="md:col-span-2">
                          <span className="font-medium text-slate-700">Assigned to:</span>
                          <span className="ml-2 text-slate-600">
                            {contact.assignments?.[0]?.sales_person?.name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3">
                    <button
                      onClick={() => setViewingContactId(contact.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                      title="View Contact"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button
                      onClick={() => setEditingContact(contact)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                      title="Edit Contact"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteItem(contact.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                      title="Delete Contact"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'module_permissions' && isAdmin && (
        <ModulePermissionsManager />
      )}

      {viewMode === 'system_settings' && isSuperAdmin && (
        <SystemSettingsPanel />
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
                    Cell Phone
                  </label>
                  <input
                    type="tel"
                    value={newUserForm.cell_phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, cell_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+12345678900 (E.164 format for SMS)"
                  />
                  <p className="text-xs text-slate-500 mt-1">Required for SMS notifications</p>
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
                    <option value="sales_processor">Sales Processor</option>
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

          {/* Bulk Friends & Family Actions */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <button
              onClick={() => {
                if (selectedUsers.size === sortedSalesPeople.length && sortedSalesPeople.length > 0) {
                  setSelectedUsers(new Set());
                } else {
                  setSelectedUsers(new Set(sortedSalesPeople.map(p => p.id)));
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
            >
              {selectedUsers.size === sortedSalesPeople.length && sortedSalesPeople.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              Select All ({sortedSalesPeople.length})
            </button>
            {selectedUsers.size > 0 && (
              <>
                <span className="text-sm text-slate-500">{selectedUsers.size} selected</span>
                <button
                  onClick={async () => {
                    const confirmed = await dialog.confirm(`Enable Friends & Family for ${selectedUsers.size} user(s)?`);
                    if (!confirmed) return;
                    const { error } = await supabase
                      .from('sales_people')
                      .update({ friends_family_enabled: true })
                      .in('id', Array.from(selectedUsers));
                    if (!error) {
                      setSalesPeople(prev => prev.map(p => selectedUsers.has(p.id) ? { ...p, friends_family_enabled: true } : p));
                      setSelectedUsers(new Set());
                    }
                  }}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  Enable F&F
                </button>
                <button
                  onClick={async () => {
                    const confirmed = await dialog.confirm(`Disable Friends & Family for ${selectedUsers.size} user(s)?`);
                    if (!confirmed) return;
                    const { error } = await supabase
                      .from('sales_people')
                      .update({ friends_family_enabled: false })
                      .in('id', Array.from(selectedUsers));
                    if (!error) {
                      setSalesPeople(prev => prev.map(p => selectedUsers.has(p.id) ? { ...p, friends_family_enabled: false } : p));
                      setSelectedUsers(new Set());
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <UserX className="w-4 h-4" />
                  Disable F&F
                </button>
                <button
                  onClick={async () => {
                    const confirmed = await dialog.confirm(`Enable File Viewer for ${selectedUsers.size} user(s)?`);
                    if (!confirmed) return;
                    const { error } = await supabase
                      .from('sales_people')
                      .update({ file_viewer_enabled: true })
                      .in('id', Array.from(selectedUsers));
                    if (!error) {
                      setSalesPeople(prev => prev.map(p => selectedUsers.has(p.id) ? { ...p, file_viewer_enabled: true } : p));
                      setSelectedUsers(new Set());
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  Enable File Viewer
                </button>
                <button
                  onClick={async () => {
                    const confirmed = await dialog.confirm(`Disable File Viewer for ${selectedUsers.size} user(s)?`);
                    if (!confirmed) return;
                    const { error } = await supabase
                      .from('sales_people')
                      .update({ file_viewer_enabled: false })
                      .in('id', Array.from(selectedUsers));
                    if (!error) {
                      setSalesPeople(prev => prev.map(p => selectedUsers.has(p.id) ? { ...p, file_viewer_enabled: false } : p));
                      setSelectedUsers(new Set());
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  Disable File Viewer
                </button>
              </>
            )}
          </div>

          <div className="overflow-x-auto border-t-2 border-slate-200" style={{ overflowX: 'auto', scrollbarWidth: 'thin', height: '20px' }} onScroll={(e) => {
            const target = e.currentTarget;
            const bottomScroll = target.nextElementSibling as HTMLElement;
            if (bottomScroll) bottomScroll.scrollLeft = target.scrollLeft;
          }}>
            <div style={{ height: '1px', minWidth: '1000px' }}></div>
          </div>
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }} onScroll={(e) => {
            const target = e.currentTarget;
            const topScroll = target.previousElementSibling as HTMLElement;
            if (topScroll) topScroll.scrollLeft = target.scrollLeft;
          }}>
            <table className="w-full" style={{ minWidth: '1000px' }}>
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 px-2 w-8">
                  <button
                    onClick={() => {
                      if (selectedUsers.size === sortedSalesPeople.length) setSelectedUsers(new Set());
                      else setSelectedUsers(new Set(sortedSalesPeople.map(p => p.id)));
                    }}
                  >
                    {selectedUsers.size === sortedSalesPeople.length && sortedSalesPeople.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  <button
                    onClick={() => handleUserSort('name')}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    Name
                    {userSortField === 'name' && (
                      userSortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  <button
                    onClick={() => handleUserSort('email')}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    Email
                    {userSortField === 'email' && (
                      userSortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  <button
                    onClick={() => handleUserSort('role')}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    Role
                    {userSortField === 'role' && (
                      userSortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  <button
                    onClick={() => handleUserSort('is_active')}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    Show in Dropdown
                    {userSortField === 'is_active' && (
                      userSortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Chat Feature</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Friends & Family</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">File Viewer</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedSalesPeople.map((person) => (
                <>
                  <tr key={person.id} className={`border-b border-slate-100 hover:bg-slate-50 ${editingId === person.id ? 'bg-blue-50' : ''}`}>
                    <td className="py-3 px-2 w-8">
                      <button onClick={() => {
                        const next = new Set(selectedUsers);
                        if (next.has(person.id)) next.delete(person.id);
                        else next.add(person.id);
                        setSelectedUsers(next);
                      }}>
                        {selectedUsers.has(person.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </td>
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
                            : person.role === 'sales_processor'
                            ? 'bg-teal-100 text-teal-800'
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
                        {person.role === 'super_admin' ? 'Super Admin' : person.role === 'admin' ? 'Admin' : person.role === 'processor' ? 'Processor' : person.role === 'sales_processor' ? 'Sales Processor' : person.role === 'closer' ? 'Closer' : 'Salesperson'}
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
                      <button
                        onClick={async () => {
                          const newValue = person.chat_enabled === false ? true : false;
                          const { error } = await supabase
                            .from('sales_people')
                            .update({ chat_enabled: newValue })
                            .eq('id', person.id);
                          if (!error) {
                            setSalesPeople(prev => prev.map(p => p.id === person.id ? { ...p, chat_enabled: newValue } : p));
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          person.chat_enabled !== false ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                        title={person.chat_enabled !== false ? 'Disable chat' : 'Enable chat'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                            person.chat_enabled !== false ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={async () => {
                          const newValue = !person.friends_family_enabled;
                          const { error } = await supabase
                            .from('sales_people')
                            .update({ friends_family_enabled: newValue })
                            .eq('id', person.id);
                          if (!error) {
                            setSalesPeople(prev => prev.map(p => p.id === person.id ? { ...p, friends_family_enabled: newValue } : p));
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          person.friends_family_enabled ? 'bg-cyan-500' : 'bg-slate-300'
                        }`}
                        title={person.friends_family_enabled ? 'Disable Friends & Family' : 'Enable Friends & Family'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                            person.friends_family_enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={async () => {
                          const newValue = !person.file_viewer_enabled;
                          const { error } = await supabase
                            .from('sales_people')
                            .update({ file_viewer_enabled: newValue })
                            .eq('id', person.id);
                          if (!error) {
                            setSalesPeople(prev => prev.map(p => p.id === person.id ? { ...p, file_viewer_enabled: newValue } : p));
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          person.file_viewer_enabled ? 'bg-blue-500' : 'bg-slate-300'
                        }`}
                        title={person.file_viewer_enabled ? 'Disable File Viewer' : 'Enable File Viewer'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                            person.file_viewer_enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
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
                        {isSuperAdmin && person.user_id && (
                          <button
                            onClick={() => impersonateUser(person)}
                            className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                            title="Log in as this user"
                            disabled={loading}
                          >
                            <LogIn className="w-4 h-4" />
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
                  </tr>
                  {editingId === person.id && editForm.id && (
                    <tr key={`${person.id}-edit`}>
                      <td colSpan={7} className="p-0">
                        <div className="bg-white">
                          <UserEditPanel
                            user={editForm as SalesPerson}
                            onSave={() => {
                              cancelEdit();
                              loadData();
                            }}
                            onCancel={cancelEdit}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {sortedSalesPeople.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-500">No sales people found</div>
          )}
          </div>
        </div>
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

      {showDuplicates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-purple-50">
              <div className="flex items-center gap-3">
                <Copy className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-bold text-slate-900">Duplicate Contact Search Results</h2>
              </div>
              <button
                onClick={closeDuplicateSearch}
                className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {searchingDuplicates ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-600">Searching for duplicates across all contacts...</p>
                  <p className="text-sm text-slate-500 mt-2">This may take a moment for large databases</p>
                </div>
              ) : duplicateGroups.length === 0 ? (
                <div className="text-center py-12">
                  <CheckSquare className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-semibold text-slate-900 mb-2">No Duplicates Found</p>
                  <p className="text-slate-600">Your database is clean! No duplicate contacts were detected.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-900 font-semibold mb-1">
                      Found {duplicateGroups.length} duplicate group{duplicateGroups.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-amber-800">
                      Review the groups below. Each group contains contacts that match by name or email.
                    </p>
                  </div>

                  {duplicateGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="border border-slate-300 rounded-lg overflow-hidden">
                      <div className="bg-slate-100 px-4 py-3 border-b border-slate-300">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900">
                            Group {groupIndex + 1} - {group.contacts.length} contacts
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            group.matchType === 'email'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            Matched by {group.matchType}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">Match value: {group.matchValue}</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Name</th>
                              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Type</th>
                              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Email</th>
                              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Phone</th>
                              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Salesperson</th>
                              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {group.contacts.map((contact, idx) => (
                              <tr key={contact.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4 text-slate-900 font-medium">{contact.name}</td>
                                <td className="py-3 px-4 text-slate-600 capitalize">{contact.type}</td>
                                <td className="py-3 px-4 text-slate-600 text-sm">{contact.email || '-'}</td>
                                <td className="py-3 px-4 text-slate-600 text-sm">{contact.phone || '-'}</td>
                                <td className="py-3 px-4 text-slate-600">{contact.salesperson || '-'}</td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setViewingContactId(contact.id);
                                        setShowDuplicates(false);
                                      }}
                                      className="text-slate-600 hover:text-slate-800 text-sm font-medium flex items-center gap-1"
                                      title="View Contact"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const fullContact = contacts.find(c => c.id === contact.id);
                                        if (fullContact) {
                                          setEditingContact(fullContact);
                                          setShowDuplicates(false);
                                        }
                                      }}
                                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                                      title="Edit Contact"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (await dialog.confirm(`Are you sure you want to delete ${contact.name}?`)) {
                                          await deleteItem(contact.id);
                                          setShowDuplicates(false);
                                          loadData();
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                      title="Delete Contact"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={closeDuplicateSearch}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
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
