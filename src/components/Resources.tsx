import { useState, useEffect } from 'react';
import { FileText, Trash2, Download, Loader, ChevronDown, ChevronUp, Eye, X, CreditCard as Edit, Mail, Search, Users, Building, BookOpen, HelpCircle, Briefcase, Megaphone, FolderOpen, GraduationCap, Plus, Settings, Pencil, Check, Star, Tag, Palette, Video, Link, ExternalLink, CheckSquare, Square, FileType, Image, BarChart3, Clock, MailOpen, MailX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDeviceDetection } from '../lib/deviceDetection';
import { useDialog } from '../contexts/DialogContext';
import { Toast } from './Toast';

const ICON_OPTIONS: Record<string, typeof FileText> = {
  FileText, GraduationCap, BookOpen, HelpCircle, Briefcase, Megaphone, FolderOpen, Star, Tag
};

const COLOR_OPTIONS = [
  { name: 'emerald', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', hoverBg: 'hover:bg-emerald-100' },
  { name: 'sky', color: 'text-sky-600', bgColor: 'bg-sky-50', borderColor: 'border-sky-200', hoverBg: 'hover:bg-sky-100' },
  { name: 'amber', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', hoverBg: 'hover:bg-amber-100' },
  { name: 'slate', color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', hoverBg: 'hover:bg-slate-100' },
  { name: 'rose', color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200', hoverBg: 'hover:bg-rose-100' },
  { name: 'teal', color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200', hoverBg: 'hover:bg-teal-100' },
  { name: 'blue', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', hoverBg: 'hover:bg-blue-100' },
  { name: 'orange', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', hoverBg: 'hover:bg-orange-100' },
  { name: 'cyan', color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200', hoverBg: 'hover:bg-cyan-100' },
];

const getColorConfig = (colorName: string) => {
  return COLOR_OPTIONS.find(c => c.name === colorName) || COLOR_OPTIONS[0];
};

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  email: string;
}

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  member_emails: string[];
}

interface Resource {
  id: string;
  title: string;
  category: string;
  file_path: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
  uploader?: {
    name: string;
  } | null;
}

interface ResourceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export function Resources() {
  const { salesPerson, isAdmin } = useAuth();
  const { isMobile } = useDeviceDetection();
  const dialog = useDialog();
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editLoading, setEditLoading] = useState(false);
  const [emailResource, setEmailResource] = useState<Resource | null>(null);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailLinkUrl, setEmailLinkUrl] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; user_id: string; name: string; email: string }>>([]);
  const [myContacts, setMyContacts] = useState<Contact[]>([]);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [trackingResource, setTrackingResource] = useState<Resource | null>(null);
  const [trackingData, setTrackingData] = useState<Array<{ id: string; recipient_email: string; recipient_name: string | null; subject: string; sent_at: string; opened_at: string | null; open_count: number; sender?: { name: string } | null }>>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ResourceCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('FileText');
  const [newCategoryColor, setNewCategoryColor] = useState('emerald');
  const [categoryActionLoading, setCategoryActionLoading] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');


  useEffect(() => {
    fetchCategories();
    fetchResources();
    fetchUsers();
    fetchUserGroups();
  }, []);

  useEffect(() => {
    if (salesPerson?.id) {
      fetchMyContacts();
    }
  }, [salesPerson?.id]);


  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('resource_categories')
      .select('*')
      .order('sort_order');

    if (!error && data) {
      setCategories(data);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('sales_people')
      .select('id, user_id, name, email')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const fetchUserGroups = async () => {
    const { data: groups, error: groupsError } = await supabase
      .from('user_groups')
      .select('id, name, description')
      .order('name');

    if (groupsError || !groups) return;

    const groupsWithMembers: UserGroup[] = await Promise.all(
      groups.map(async (group) => {
        const { data: members } = await supabase
          .from('user_group_members')
          .select('user_id')
          .eq('group_id', group.id);

        const userIds = members?.map(m => m.user_id) || [];

        const { data: salesPeopleData } = await supabase
          .from('sales_people')
          .select('email')
          .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
          .eq('is_active', true);

        const emails = salesPeopleData?.map(sp => sp.email).filter(Boolean) || [];

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          member_count: emails.length,
          member_emails: emails
        };
      })
    );

    setUserGroups(groupsWithMembers);
  };

  const fetchMyContacts = async () => {
    if (!salesPerson?.id) return;

    const { data: sharedAccess } = await supabase
      .from('shared_contact_access')
      .select('salesperson_id')
      .eq('viewer_id', salesPerson.id);

    const accessibleIds = [salesPerson.id];
    if (sharedAccess) {
      accessibleIds.push(...sharedAccess.map(sa => sa.salesperson_id));
    }

    const [assignedResult, globalResult] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, first_name, last_name, company, email, assignments!inner(salesperson_id)')
        .in('assignments.salesperson_id', accessibleIds)
        .not('email', 'is', null)
        .neq('email', ''),
      supabase
        .from('contacts')
        .select('id, first_name, last_name, company, email')
        .eq('is_global', true)
        .not('email', 'is', null)
        .neq('email', '')
    ]);

    const assigned = assignedResult.data || [];
    const global = globalResult.data || [];
    const assignedIds = new Set(assigned.map(c => c.id));
    const uniqueGlobal = global.filter(c => !assignedIds.has(c.id));

    setMyContacts([...assigned, ...uniqueGlobal]);
  };

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('category')
        .order('title');

      if (error) throw error;

      setResources(data || []);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (resource: Resource) => {
    try {
      const { data, error } = await supabase.storage
        .from('resources')
        .download(resource.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      setPreviewResource(resource);
    } catch (error) {
      console.error('Error previewing resource:', error);
      await dialog.alert('Failed to preview resource');
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewResource(null);
  };

  const handleDownload = async (resource: Resource) => {
    try {
      const { data, error } = await supabase.storage
        .from('resources')
        .download(resource.file_path);

      if (error) throw error;

      const ext = resource.file_path.split('.').pop() || 'pdf';
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resource.title}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading resource:', error);
      await dialog.alert('Failed to download resource');
    }
  };

  const handleDelete = async (resource: Resource) => {
    if (!(await dialog.confirm(`Are you sure you want to delete "${resource.title}"?`))) return;

    try {
      const { error: dbError } = await supabase
        .from('resources')
        .delete()
        .eq('id', resource.id);

      if (dbError) throw dbError;

      const { error: storageError } = await supabase.storage
        .from('resources')
        .remove([resource.file_path]);

      if (storageError) console.error('Error deleting file from storage:', storageError);

      await fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      await dialog.alert('Failed to delete resource');
    }
  };

  const handleEditClick = (resource: Resource) => {
    setEditingResource(resource);
    setEditCategory(resource.category);
  };

  const handleEditCancel = () => {
    setEditingResource(null);
    setEditCategory('');
  };

  const handleEditSave = async () => {
    if (!editingResource) return;

    // Only admins and super admins can change categories
    if (!isAdmin) {
      await dialog.alert('You do not have permission to change resource categories.');
      return;
    }

    setEditLoading(true);

    try {
      const oldFilePath = editingResource.file_path;
      const oldCategory = editingResource.category;

      // If category changed, we need to move the file in storage
      if (oldCategory !== editCategory) {
        const fileName = oldFilePath.split('/').pop();
        const newFilePath = `${editCategory}/${fileName}`;

        // Download the file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('resources')
          .download(oldFilePath);

        if (downloadError) {
          console.error('Download error:', downloadError);
          throw new Error(`Failed to download file: ${downloadError.message}`);
        }

        // Check if file exists at new location and remove it
        const { data: existingFiles } = await supabase.storage
          .from('resources')
          .list(editCategory);

        if (existingFiles?.some(file => file.name === fileName)) {
          await supabase.storage.from('resources').remove([newFilePath]);
        }

        // Upload to new location
        const { error: uploadError } = await supabase.storage
          .from('resources')
          .upload(newFilePath, fileData);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        // Update database record
        const { error: updateError } = await supabase
          .from('resources')
          .update({
            category: editCategory,
            file_path: newFilePath,
          })
          .eq('id', editingResource.id);

        if (updateError) {
          console.error('Database update error:', updateError);
          // Rollback: delete the newly uploaded file
          await supabase.storage.from('resources').remove([newFilePath]);
          throw new Error(`Failed to update database: ${updateError.message}`);
        }

        // Delete old file from storage
        const { error: deleteError } = await supabase.storage
          .from('resources')
          .remove([oldFilePath]);

        if (deleteError) console.error('Error deleting old file from storage:', deleteError);
      }

      await fetchResources();
      handleEditCancel();
    } catch (error: any) {
      console.error('Error updating resource:', error);
      await dialog.alert(error.message || 'Failed to update resource category');
    } finally {
      setEditLoading(false);
    }
  };

  const handleViewTracking = async (resource: Resource) => {
    setTrackingResource(resource);
    setTrackingLoading(true);
    try {
      const { data, error } = await supabase
        .from('resource_email_sends')
        .select('id, recipient_email, recipient_name, subject, sent_at, opened_at, open_count, sender_id')
        .eq('resource_id', resource.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      const senderIds = [...new Set((data || []).map(d => d.sender_id).filter(Boolean))];
      let senderMap: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: senders } = await supabase
          .from('sales_people')
          .select('id, name')
          .in('id', senderIds);
        if (senders) {
          senderMap = Object.fromEntries(senders.map(s => [s.id, s.name]));
        }
      }

      setTrackingData((data || []).map(d => ({
        ...d,
        sender: d.sender_id ? { name: senderMap[d.sender_id] || 'Unknown' } : null,
      })));
    } catch {
      setNotification({ type: 'error', message: 'Failed to load email tracking data' });
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleEmailClick = (resource: Resource) => {
    setEmailResource(resource);
    setEmailRecipients([]);
    setManualEmail('');
    setUserSearchTerm('');

    const isDayAtTheRaces = resource.title.toLowerCase().includes('day at the races');
    if (isDayAtTheRaces) {
      setEmailSubject('You are invited! Evident Title\'s Day at the Races!');
      setEmailMessage('Evident Title Agency is pleased to invite you and a guest to our Day at the Races Client Appreciation Event at the Meadowlands Racetrack!\n\nThank you for being a valued and loyal client. We appreciate your partnership and look forward to celebrating with you. Hope to see you there!');
      setEmailLinkUrl('https://www.evidenttitle.com/ev/');
    } else {
      setEmailSubject(resource.title);
      setEmailMessage(`Please find the attached document "${resource.title}" from Evident Title.\n\nIf you have any questions, feel free to reach out.`);
      setEmailLinkUrl('');
    }
  };

  const handleEmailCancel = () => {
    setEmailResource(null);
    setEmailSubject('');
    setEmailMessage('');
    setEmailRecipients([]);
    setManualEmail('');
    setUserSearchTerm('');
    setContactSearchTerm('');
    setEmailLinkUrl('');
  };


  const handleAddManualEmail = () => {
    const trimmedEmail = manualEmail.trim().toLowerCase();
    if (trimmedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) && !emailRecipients.includes(trimmedEmail)) {
      setEmailRecipients([...emailRecipients, trimmedEmail]);
      setManualEmail('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setEmailRecipients(emailRecipients.filter(e => e !== email));
  };

  const handleAddUserEmail = (email: string) => {
    const lowercaseEmail = email.toLowerCase();
    if (!emailRecipients.includes(lowercaseEmail)) {
      setEmailRecipients([...emailRecipients, lowercaseEmail]);
    }
  };

  const handleAddGroupEmails = (group: UserGroup) => {
    const newEmails = group.member_emails
      .map(e => e.toLowerCase())
      .filter(e => !emailRecipients.includes(e));
    if (newEmails.length > 0) {
      setEmailRecipients([...emailRecipients, ...newEmails]);
    }
  };

  const handleSelectAllContacts = () => {
    const contactEmails = filteredContacts
      .filter(c => c.email)
      .map(c => c.email.toLowerCase())
      .filter(e => !emailRecipients.includes(e));
    if (contactEmails.length > 0) {
      setEmailRecipients([...emailRecipients, ...contactEmails]);
    }
  };

  const handleSelectAllUsers = () => {
    const userEmails = filteredEmailUsers
      .filter(u => u.email)
      .map(u => u.email.toLowerCase())
      .filter(e => !emailRecipients.includes(e));
    if (userEmails.length > 0) {
      setEmailRecipients([...emailRecipients, ...userEmails]);
    }
  };

  const handleSendEmail = async () => {
    if (!emailResource || emailRecipients.length === 0) {
      setNotification({ type: 'error', message: 'Please add at least one recipient' });
      return;
    }

    if (!emailSubject.trim()) {
      setNotification({ type: 'error', message: 'Please enter a subject' });
      return;
    }

    if (!emailMessage.trim()) {
      setNotification({ type: 'error', message: 'Please enter a message' });
      return;
    }

    setEmailSending(true);

    try {
      const { data: senderData } = await supabase
        .from('sales_people')
        .select('email')
        .eq('id', salesPerson?.id)
        .maybeSingle();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Your session has expired. Please log in again.');
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const recipientNames: Record<string, string> = {};
      for (const email of emailRecipients) {
        const lowerEmail = email.toLowerCase();
        const matchedContact = myContacts.find(c => c.email.toLowerCase() === lowerEmail);
        if (matchedContact) {
          recipientNames[lowerEmail] = matchedContact.first_name;
        } else {
          const matchedUser = users.find(u => u.email.toLowerCase() === lowerEmail);
          if (matchedUser) {
            recipientNames[lowerEmail] = matchedUser.name.split(' ')[0];
          }
        }
      }

      const payload: Record<string, unknown> = {
        resourceId: emailResource.id,
        recipientEmails: emailRecipients,
        recipientNames,
        subject: emailSubject,
        message: emailMessage,
        senderEmail: senderData?.email,
        linkUrl: emailLinkUrl.trim() || undefined,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-resource`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(payload),
        }
      );

      const resultText = await response.text();
      let result: Record<string, unknown>;
      try {
        result = JSON.parse(resultText);
      } catch {
        throw new Error(`Server error: ${resultText.substring(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(result.error as string || `Failed to send email (${response.status})`);
      }

      if (result.sent > 0) {
        setNotification({
          type: 'success',
          message: `Document emailed successfully to ${result.sent} recipient${result.sent > 1 ? 's' : ''}!`
        });
        handleEmailCancel();
      } else {
        throw new Error('Failed to send email to any recipients');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setNotification({ type: 'error', message: error instanceof Error ? error.message : 'Failed to send email' });
    } finally {
      setEmailSending(false);
    }
  };

  const filteredEmailUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  ).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const filteredContacts = myContacts.filter(c => {
    const term = contactSearchTerm.toLowerCase();
    return (c.first_name || '').toLowerCase().includes(term) ||
      (c.last_name || '').toLowerCase().includes(term) ||
      (c.company || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term);
  }).sort((a, b) => {
    const firstA = (a.first_name || '').toLowerCase();
    const firstB = (b.first_name || '').toLowerCase();
    if (firstA !== firstB) return firstA.localeCompare(firstB);
    return (a.last_name || '').toLowerCase().localeCompare((b.last_name || '').toLowerCase());
  });

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileType = (filePath: string): 'pdf' | 'video' | 'link' | 'word' | 'image' | 'other' => {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return 'link';
    }
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['mp4', 'webm', 'mov', 'avi', 'wmv'].includes(ext || '')) return 'video';
    if (['doc', 'docx'].includes(ext || '')) return 'word';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '')) return 'image';
    return 'other';
  };

  const getFileMimeType = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      wmv: 'video/x-ms-wmv',
    };
    return mimeTypes[ext || ''] || 'video/mp4';
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setNotification({ type: 'error', message: 'Please enter a category name' });
      return;
    }

    setCategoryActionLoading(true);
    try {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) : 0;

      const { error } = await supabase
        .from('resource_categories')
        .insert({
          name: newCategoryName.trim(),
          icon: newCategoryIcon,
          color: newCategoryColor,
          sort_order: maxOrder + 1
        });

      if (error) throw error;

      await fetchCategories();
      setNewCategoryName('');
      setNewCategoryIcon('FileText');
      setNewCategoryColor('emerald');
      setShowAddCategory(false);
      setNotification({ type: 'success', message: 'Category created successfully' });
    } catch (error: any) {
      console.error('Error creating category:', error);
      setNotification({ type: 'error', message: error.message || 'Failed to create category' });
    } finally {
      setCategoryActionLoading(false);
    }
  };

  const handleEditCategoryClick = (category: ResourceCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryIcon(category.icon);
    setNewCategoryColor(category.color);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !newCategoryName.trim()) return;

    setCategoryActionLoading(true);
    try {
      const oldName = editingCategory.name;
      const newName = newCategoryName.trim();

      const { error: updateError } = await supabase
        .from('resource_categories')
        .update({
          name: newName,
          icon: newCategoryIcon,
          color: newCategoryColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingCategory.id);

      if (updateError) throw updateError;

      if (oldName !== newName) {
        const { error: resourcesUpdateError } = await supabase
          .from('resources')
          .update({ category: newName })
          .eq('category', oldName);

        if (resourcesUpdateError) {
          console.error('Failed to update resources category:', resourcesUpdateError);
          throw new Error('Failed to update resources with new category name');
        }
      }

      await fetchCategories();
      await fetchResources();
      setEditingCategory(null);
      setNewCategoryName('');
      setNewCategoryIcon('FileText');
      setNewCategoryColor('emerald');
      setNotification({ type: 'success', message: 'Category updated successfully' });
    } catch (error: any) {
      console.error('Error updating category:', error);
      setNotification({ type: 'error', message: error.message || 'Failed to update category' });
    } finally {
      setCategoryActionLoading(false);
    }
  };

  const handleCancelCategoryEdit = () => {
    setEditingCategory(null);
    setShowAddCategory(false);
    setNewCategoryName('');
    setNewCategoryIcon('FileText');
    setNewCategoryColor('emerald');
  };

  const visibleCategories = categories.filter(c => c.is_active);

  const filteredResources = resourceSearchTerm.trim()
    ? resources.filter(r =>
        r.title.toLowerCase().includes(resourceSearchTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(resourceSearchTerm.toLowerCase())
      )
    : resources;

  const resourcesByCategory = visibleCategories.reduce((acc, category) => {
    acc[category.name] = filteredResources.filter(r => r.category === category.name);
    return acc;
  }, {} as Record<string, Resource[]>);

  const categoriesToShow = resourceSearchTerm.trim()
    ? visibleCategories.filter(c => resourcesByCategory[c.name]?.length > 0)
    : visibleCategories;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Resources</h2>
            <p className="text-sm text-gray-500">Access documents, tutorials, and guides</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowCategoryManager(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Manage Categories</span>
            </button>
          )}
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <FileText className="h-4 w-4" />
            <span>{resources.length} files</span>
          </div>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search resources by title or category..."
          value={resourceSearchTerm}
          onChange={(e) => setResourceSearchTerm(e.target.value)}
          className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-gray-900 placeholder-gray-500"
        />
        {resourceSearchTerm && (
          <button
            onClick={() => setResourceSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {resourceSearchTerm.trim() && filteredResources.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No resources found matching "{resourceSearchTerm}"</p>
          <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
        </div>
      )}

      {resourceSearchTerm.trim() && filteredResources.length > 0 && (
        <p className="text-sm text-gray-500">
          Found {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''} matching "{resourceSearchTerm}"
        </p>
      )}

      <div className="grid gap-5">
        {categoriesToShow.map(category => {
          const categoryResources = resourcesByCategory[category.name] || [];
          const isExpanded = resourceSearchTerm.trim() ? true : expandedCategories.has(category.name);
          const colorConfig = getColorConfig(category.color);
          const IconComponent = ICON_OPTIONS[category.icon] || FileText;

          return (
            <div
              key={category.id}
              className={`rounded-2xl border-2 ${colorConfig.borderColor} overflow-hidden bg-white shadow-md hover:shadow-lg transition-all duration-200`}
            >
              <button
                onClick={() => toggleCategory(category.name)}
                className={`w-full px-6 py-5 flex items-center justify-between transition-all duration-200 ${colorConfig.bgColor} ${colorConfig.hoverBg}`}
              >
                <div className="flex items-center gap-5">
                  <div className={`p-3.5 rounded-xl bg-white shadow-md border-2 ${colorConfig.borderColor}`}>
                    <IconComponent className={`h-7 w-7 ${colorConfig.color}`} />
                  </div>
                  <div className="text-left">
                    <h3 className={`text-xl font-bold ${colorConfig.color}`}>{category.name}</h3>
                    <p className="text-sm text-gray-600 mt-1 font-medium">
                      {categoryResources.length} {categoryResources.length === 1 ? 'document' : 'documents'}
                    </p>
                  </div>
                </div>
                <div className={`p-2.5 rounded-xl transition-all duration-200 ${isExpanded ? 'bg-white shadow-md' : ''}`}>
                  {isExpanded ? (
                    <ChevronUp className={`h-6 w-6 ${colorConfig.color}`} />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-gray-400" />
                  )}
                </div>
              </button>

              <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="border-t border-gray-100 bg-white">
                  {categoryResources.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <div className={`inline-flex p-3 rounded-full ${colorConfig.bgColor} mb-3`}>
                        <IconComponent className={`h-6 w-6 ${colorConfig.color} opacity-50`} />
                      </div>
                      <p className="text-gray-500 text-sm">No resources in this category yet</p>
                    </div>
                  ) : (
                    <div className="p-3">
                      <div className="space-y-2">
                        {categoryResources.map(resource => {
                          const fileType = getFileType(resource.file_path);
                          const isVideo = fileType === 'video';
                          const isLink = fileType === 'link';
                          const isWord = fileType === 'word';
                          const isImage = fileType === 'image';
                          return (
                          <div
                            key={resource.id}
                            className="group flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all duration-150"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`p-2 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all duration-150 ${
                                isLink ? 'bg-emerald-100' : isVideo ? 'bg-blue-100' : isWord ? 'bg-sky-100' : isImage ? 'bg-purple-100' : 'bg-gray-100'
                              }`}>
                                {isLink ? (
                                  <Link className="h-4 w-4 text-emerald-600" />
                                ) : isVideo ? (
                                  <Video className="h-4 w-4 text-blue-600" />
                                ) : isWord ? (
                                  <FileType className="h-4 w-4 text-sky-600" />
                                ) : isImage ? (
                                  <Image className="h-4 w-4 text-purple-600" />
                                ) : (
                                  <FileText className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {isLink ? (
                                    <a
                                      href={resource.file_path}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline truncate text-sm"
                                    >
                                      {resource.title}
                                    </a>
                                  ) : (
                                    <h4 className="font-medium text-gray-900 truncate text-sm">{resource.title}</h4>
                                  )}
                                  {isLink && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded flex-shrink-0">
                                      Link
                                    </span>
                                  )}
                                  {isVideo && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded flex-shrink-0">
                                      Video
                                    </span>
                                  )}
                                  {isWord && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium bg-sky-100 text-sky-700 rounded flex-shrink-0">
                                      Word
                                    </span>
                                  )}
                                  {isImage && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded flex-shrink-0">
                                      Image
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {isLink ? (
                                    <span className="truncate block max-w-xs">{new Date(resource.created_at).toLocaleDateString()}</span>
                                  ) : (
                                    <>{formatFileSize(resource.file_size)} • {new Date(resource.created_at).toLocaleDateString()}</>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-3 opacity-70 group-hover:opacity-100 transition-opacity">
                              {isLink ? (
                                <a
                                  href={resource.file_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Open Link"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : isWord || isImage ? (
                                <>
                                  <button
                                    onClick={() => handlePreview(resource)}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title={isImage ? 'View Image' : 'View Document'}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDownload(resource)}
                                    className={`p-2 ${isImage ? 'text-blue-600 hover:bg-blue-50' : 'text-sky-600 hover:bg-sky-50'} rounded-lg transition-colors`}
                                    title="Download"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEmailClick(resource)}
                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                    title="Email Document"
                                  >
                                    <Mail className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleViewTracking(resource)}
                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="View Email Opens"
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handlePreview(resource)}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title={isVideo ? 'Play Video' : 'View PDF'}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDownload(resource)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Download"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEmailClick(resource)}
                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                    title="Email Document"
                                  >
                                    <Mail className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleViewTracking(resource)}
                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="View Email Opens"
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => handleEditClick(resource)}
                                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                    title="Edit Category"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(resource)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {previewResource && previewUrl && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 ${isMobile ? 'p-0' : 'p-4'}`}>
          <div className={`bg-white shadow-xl w-full flex flex-col ${isMobile ? 'h-full' : 'rounded-lg max-w-6xl h-[95vh]'}`}>
            <div className={`flex items-center justify-between border-b border-gray-200 flex-shrink-0 ${isMobile ? 'p-3' : 'p-4'}`}>
              <h3 className={`font-semibold text-gray-900 truncate mr-2 ${isMobile ? 'text-sm' : 'text-lg'}`}>
                {previewResource.title}
              </h3>
              <button
                onClick={closePreview}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                title="Close"
              >
                <X className={isMobile ? 'h-5 w-5' : 'h-6 w-6'} />
              </button>
            </div>
            <div className="flex-1 overflow-auto -webkit-overflow-scrolling-touch">
              {getFileType(previewResource.file_path) === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-black p-4">
                  <video
                    src={previewUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-full rounded-lg"
                    style={{ maxHeight: 'calc(95vh - 80px)' }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : getFileType(previewResource.file_path) === 'image' ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 p-4">
                  <img
                    src={previewUrl}
                    alt={previewResource.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    style={{ maxHeight: 'calc(95vh - 80px)' }}
                  />
                </div>
              ) : isMobile ? (
                <iframe
                  src={`${previewUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-0"
                  title={previewResource.title}
                  style={{ minHeight: '100%' }}
                />
              ) : (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="w-full h-full min-h-[600px]"
                  title={previewResource.title}
                >
                  <iframe
                    src={previewUrl}
                    className="w-full h-full min-h-[600px]"
                    title={previewResource.title}
                  />
                </object>
              )}
            </div>
          </div>
        </div>
      )}

      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Resource Category
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resource
                </label>
                <p className="text-gray-900 font-medium">{editingResource.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Category
                </label>
                <p className="text-gray-600">{editingResource.category}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.name}>{category.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEditCancel}
                disabled={editLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading || editCategory === editingResource.category}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {editLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {emailResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="h-5 w-5 text-amber-600" />
                Email Document
              </h3>
              <button
                onClick={handleEmailCancel}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{emailResource.title}</p>
                    <p className="text-sm text-gray-600">{formatFileSize(emailResource.file_size)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipients
                </label>

                {emailRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {emailRecipients.map(email => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {email}
                        <button
                          onClick={() => handleRemoveRecipient(email)}
                          className="hover:text-blue-900"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Add external email</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddManualEmail();
                          }
                        }}
                        placeholder="client@example.com"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleAddManualEmail}
                        disabled={!manualEmail.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {myContacts.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm text-gray-600 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          My Contacts ({myContacts.length})
                        </label>
                        {filteredContacts.length > 0 && (
                          <button
                            onClick={handleSelectAllContacts}
                            disabled={filteredContacts.every(c => emailRecipients.includes(c.email.toLowerCase()))}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            {filteredContacts.every(c => emailRecipients.includes(c.email.toLowerCase())) ? (
                              <CheckSquare className="w-3.5 h-3.5" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                            Select All
                          </button>
                        )}
                      </div>
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Search contacts..."
                          value={contactSearchTerm}
                          onChange={(e) => setContactSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                        {filteredContacts.length === 0 ? (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No contacts found
                          </div>
                        ) : (
                          filteredContacts.map(contact => (
                            <button
                              key={contact.id}
                              onClick={() => handleAddUserEmail(contact.email)}
                              disabled={emailRecipients.includes(contact.email.toLowerCase())}
                              className={`w-full flex items-center p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                emailRecipients.includes(contact.email.toLowerCase()) ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">
                                  {contact.first_name} {contact.last_name}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Building className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{contact.company}</span>
                                </div>
                                <div className="text-sm text-gray-500 truncate">{contact.email}</div>
                              </div>
                              {emailRecipients.includes(contact.email.toLowerCase()) && (
                                <span className="text-xs text-green-600 font-medium flex-shrink-0 ml-2">Added</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {userGroups.length > 0 && (
                    <div>
                      <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Groups ({userGroups.length})
                      </label>
                      <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                        {userGroups.map(group => {
                          const allAdded = group.member_emails.every(e =>
                            emailRecipients.includes(e.toLowerCase())
                          );
                          const someAdded = group.member_emails.some(e =>
                            emailRecipients.includes(e.toLowerCase())
                          );
                          return (
                            <button
                              key={group.id}
                              onClick={() => handleAddGroupEmails(group)}
                              disabled={allAdded || group.member_count === 0}
                              className={`w-full flex items-center p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                allAdded ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">
                                  {group.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                                  {group.description && ` - ${group.description}`}
                                </div>
                              </div>
                              {allAdded ? (
                                <span className="text-xs text-green-600 font-medium flex-shrink-0 ml-2">All Added</span>
                              ) : someAdded ? (
                                <span className="text-xs text-amber-600 font-medium flex-shrink-0 ml-2">Partial</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-gray-600">Team members</label>
                      {filteredEmailUsers.length > 0 && (
                        <button
                          onClick={handleSelectAllUsers}
                          disabled={filteredEmailUsers.every(u => emailRecipients.includes(u.email.toLowerCase()))}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {filteredEmailUsers.every(u => emailRecipients.includes(u.email.toLowerCase())) ? (
                            <CheckSquare className="w-3.5 h-3.5" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                          Select All
                        </button>
                      )}
                    </div>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search team members..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="border border-gray-300 rounded-lg max-h-40 overflow-y-auto">
                      {filteredEmailUsers.map(u => (
                        <button
                          key={u.id}
                          onClick={() => handleAddUserEmail(u.email)}
                          disabled={emailRecipients.includes(u.email.toLowerCase())}
                          className={`w-full flex items-center p-3 text-left hover:bg-gray-50 transition-colors ${
                            emailRecipients.includes(u.email.toLowerCase()) ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                          }`}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{u.name}</div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                          </div>
                          {emailRecipients.includes(u.email.toLowerCase()) && (
                            <span className="text-xs text-green-600 font-medium">Added</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {emailResource?.file_path && emailResource.file_size > 0 && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center gap-1.5">
                        <Link className="h-4 w-4 text-blue-600" />
                        <span>Link URL</span>
                        <span className="text-gray-400 font-normal">(optional)</span>
                      </div>
                    </label>
                    <input
                      type="url"
                      value={emailLinkUrl}
                      onChange={(e) => setEmailLinkUrl(e.target.value)}
                      placeholder="https://example.com — clicking the image will open this link"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    {emailLinkUrl.trim() && (
                      <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        The resource image in the email will be clickable and open this URL
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">
                        The document will be automatically attached to the email and sent directly to the recipients.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={handleEmailCancel}
                disabled={emailSending}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailSending || emailRecipients.length === 0}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {emailSending ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCategoryManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Settings className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Manage Categories</h3>
                  <p className="text-sm text-gray-500">Add, edit, or organize resource categories</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCategoryManager(false);
                  handleCancelCategoryEdit();
                }}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {categories.map((category) => {
                  const isEditing = editingCategory?.id === category.id;
                  const catColorConfig = getColorConfig(category.color);
                  const CatIcon = ICON_OPTIONS[category.icon] || FileText;

                  if (isEditing) {
                    return (
                      <div key={category.id} className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                            <input
                              type="text"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter category name"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(ICON_OPTIONS).map(([iconName, Icon]) => (
                                <button
                                  key={iconName}
                                  onClick={() => setNewCategoryIcon(iconName)}
                                  className={`p-2.5 rounded-lg border-2 transition-all ${
                                    newCategoryIcon === iconName
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 hover:border-gray-300 bg-white'
                                  }`}
                                >
                                  <Icon className={`h-5 w-5 ${newCategoryIcon === iconName ? 'text-blue-600' : 'text-gray-500'}`} />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                            <div className="flex flex-wrap gap-2">
                              {COLOR_OPTIONS.map((colorOpt) => (
                                <button
                                  key={colorOpt.name}
                                  onClick={() => setNewCategoryColor(colorOpt.name)}
                                  className={`p-2.5 rounded-lg border-2 transition-all ${colorOpt.bgColor} ${
                                    newCategoryColor === colorOpt.name
                                      ? 'border-gray-800 ring-2 ring-gray-400'
                                      : `${colorOpt.borderColor} hover:border-gray-400`
                                  }`}
                                >
                                  <Palette className={`h-5 w-5 ${colorOpt.color}`} />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleCancelCategoryEdit}
                              disabled={categoryActionLoading}
                              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleUpdateCategory}
                              disabled={categoryActionLoading || !newCategoryName.trim()}
                              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                            >
                              {categoryActionLoading ? (
                                <>
                                  <Loader className="h-4 w-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4" />
                                  Save Changes
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={category.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 ${catColorConfig.borderColor} ${catColorConfig.bgColor} transition-all hover:shadow-sm`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg bg-white shadow-sm border ${catColorConfig.borderColor}`}>
                          <CatIcon className={`h-5 w-5 ${catColorConfig.color}`} />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{category.name}</h4>
                          <p className="text-xs text-gray-500">
                            {resourcesByCategory[category.name]?.length || 0} documents
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditCategoryClick(category)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                        title="Edit category"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}

                {showAddCategory ? (
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-200 border-dashed rounded-xl">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Category Name</label>
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="Enter category name"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(ICON_OPTIONS).map(([iconName, Icon]) => (
                            <button
                              key={iconName}
                              onClick={() => setNewCategoryIcon(iconName)}
                              className={`p-2.5 rounded-lg border-2 transition-all ${
                                newCategoryIcon === iconName
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <Icon className={`h-5 w-5 ${newCategoryIcon === iconName ? 'text-emerald-600' : 'text-gray-500'}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                        <div className="flex flex-wrap gap-2">
                          {COLOR_OPTIONS.map((colorOpt) => (
                            <button
                              key={colorOpt.name}
                              onClick={() => setNewCategoryColor(colorOpt.name)}
                              className={`p-2.5 rounded-lg border-2 transition-all ${colorOpt.bgColor} ${
                                newCategoryColor === colorOpt.name
                                  ? 'border-gray-800 ring-2 ring-gray-400'
                                  : `${colorOpt.borderColor} hover:border-gray-400`
                              }`}
                            >
                              <Palette className={`h-5 w-5 ${colorOpt.color}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleCancelCategoryEdit}
                          disabled={categoryActionLoading}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddCategory}
                          disabled={categoryActionLoading || !newCategoryName.trim()}
                          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                        >
                          {categoryActionLoading ? (
                            <>
                              <Loader className="h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" />
                              Create Category
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowAddCategory(true);
                      setEditingCategory(null);
                    }}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Add New Category
                  </button>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowCategoryManager(false);
                  handleCancelCategoryEdit();
                }}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {trackingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Email Tracking</h3>
                  <p className="text-sm text-gray-500">{trackingResource.title}</p>
                </div>
              </div>
              <button
                onClick={() => { setTrackingResource(null); setTrackingData([]); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {trackingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
              ) : trackingData.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No emails sent yet</p>
                  <p className="text-sm text-gray-400 mt-1">Send this resource via email to start tracking opens.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-blue-700">{trackingData.length}</p>
                      <p className="text-xs text-blue-600 mt-1 font-medium">Total Sent</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-700">{trackingData.filter(d => d.opened_at).length}</p>
                      <p className="text-xs text-emerald-600 mt-1 font-medium">Opened</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-amber-700">{trackingData.filter(d => !d.opened_at).length}</p>
                      <p className="text-xs text-amber-600 mt-1 font-medium">Unopened</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {trackingData.map((send) => (
                      <div key={send.id} className={`flex items-center justify-between p-3 rounded-lg border ${send.opened_at ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-full ${send.opened_at ? 'bg-emerald-100' : 'bg-gray-200'}`}>
                            {send.opened_at ? <MailOpen className="h-4 w-4 text-emerald-600" /> : <MailX className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {send.recipient_name || send.recipient_email}
                            </p>
                            {send.recipient_name && (
                              <p className="text-xs text-gray-500 truncate">{send.recipient_email}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          {send.opened_at ? (
                            <div>
                              <p className="text-xs font-medium text-emerald-700">Opened</p>
                              <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                                <Clock className="h-3 w-3" />
                                {new Date(send.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                                {new Date(send.opened_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                              {send.open_count > 1 && (
                                <p className="text-xs text-gray-400">{send.open_count} times</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-medium text-gray-400">Not opened</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                                <Clock className="h-3 w-3" />
                                Sent {new Date(send.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-gray-200 p-4 flex justify-between items-center">
              <p className="text-xs text-gray-400">
                {trackingData.length > 0 && `Sent by: ${[...new Set(trackingData.map(d => d.sender?.name).filter(Boolean))].join(', ')}`}
              </p>
              <button
                onClick={() => { setTrackingResource(null); setTrackingData([]); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Toast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
