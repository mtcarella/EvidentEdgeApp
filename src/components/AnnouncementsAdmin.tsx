import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Pin, PinOff, Eye, EyeOff, AlertTriangle, Info, FileText, X, Save, Calendar, Clock, Paperclip, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'urgent' | 'informational' | 'procedural';
  is_active: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  created_by: string;
  creator_name?: string;
  attachment_name?: string | null;
  attachment_path?: string | null;
  attachment_size?: number | null;
}

const categoryConfig = {
  urgent: {
    icon: AlertTriangle,
    label: 'Time Sensitive',
    description: 'Time-sensitive updates requiring immediate attention',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconColor: 'text-red-500',
  },
  informational: {
    icon: Info,
    label: 'Informational',
    description: 'General information and updates',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    iconColor: 'text-blue-500',
  },
  procedural: {
    icon: FileText,
    label: 'Procedural',
    description: 'Policy and procedure changes',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    iconColor: 'text-amber-500',
  },
};

export function AnnouncementsAdmin() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'informational' as 'urgent' | 'informational' | 'procedural',
    is_pinned: false,
    expires_at: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<{ name: string; path: string; size: number } | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const announcementsWithCreators = await Promise.all(
        (data || []).map(async (announcement) => {
          if (announcement.created_by) {
            const { data: creator } = await supabase
              .from('sales_people')
              .select('name')
              .eq('user_id', announcement.created_by)
              .maybeSingle();
            return { ...announcement, creator_name: creator?.name || 'Unknown' };
          }
          return { ...announcement, creator_name: 'System' };
        })
      );

      setAnnouncements(announcementsWithCreators);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingAnnouncement(null);
    setFormData({
      title: '',
      content: '',
      category: 'informational',
      is_pinned: false,
      expires_at: '',
    });
    setFormError(null);
    setSelectedFile(null);
    setExistingAttachment(null);
    setRemoveAttachment(false);
    setShowModal(true);
  };

  const openEditModal = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      category: announcement.category,
      is_pinned: announcement.is_pinned,
      expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
    });
    setFormError(null);
    setSelectedFile(null);
    setRemoveAttachment(false);
    if (announcement.attachment_name && announcement.attachment_path && announcement.attachment_size) {
      setExistingAttachment({
        name: announcement.attachment_name,
        path: announcement.attachment_path,
        size: announcement.attachment_size,
      });
    } else {
      setExistingAttachment(null);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!formData.content.trim()) {
      setFormError('Content is required');
      return;
    }

    setSaving(true);

    try {
      let attachmentData: { attachment_name: string | null; attachment_path: string | null; attachment_size: number | null } = {
        attachment_name: null,
        attachment_path: null,
        attachment_size: null,
      };

      // Handle attachment removal
      if (removeAttachment && existingAttachment) {
        await supabase.storage.from('announcement-attachments').remove([existingAttachment.path]);
      }
      // Handle new file upload
      else if (selectedFile) {
        // If editing and replacing an existing attachment, delete the old one
        if (editingAnnouncement && existingAttachment) {
          await supabase.storage.from('announcement-attachments').remove([existingAttachment.path]);
        }

        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('announcement-attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        attachmentData = {
          attachment_name: selectedFile.name,
          attachment_path: filePath,
          attachment_size: selectedFile.size,
        };
      }
      // Keep existing attachment if not removing or replacing
      else if (existingAttachment && !removeAttachment) {
        attachmentData = {
          attachment_name: existingAttachment.name,
          attachment_path: existingAttachment.path,
          attachment_size: existingAttachment.size,
        };
      }

      const announcementData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category,
        is_pinned: formData.is_pinned,
        expires_at: formData.expires_at || null,
        ...attachmentData,
      };

      if (editingAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', editingAnnouncement.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert({
            ...announcementData,
            created_by: user?.id,
          });

        if (error) throw error;
      }

      setShowModal(false);
      fetchAnnouncements();
    } catch (error: any) {
      setFormError(error.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (announcement: Announcement) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: !announcement.is_active })
        .eq('id', announcement.id);

      if (error) throw error;
      fetchAnnouncements();
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  };

  const togglePinned = async (announcement: Announcement) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_pinned: !announcement.is_pinned })
        .eq('id', announcement.id);

      if (error) throw error;
      fetchAnnouncements();
    } catch (error) {
      console.error('Error toggling pinned status:', error);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      // Find the announcement to get its attachment path
      const announcement = announcements.find(a => a.id === id);

      // Delete the attachment file if it exists
      if (announcement?.attachment_path) {
        await supabase.storage
          .from('announcement-attachments')
          .remove([announcement.attachment_path]);
      }

      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setShowDeleteConfirm(null);
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        setFormError('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setRemoveAttachment(false);
    }
  };

  const downloadAttachment = async (path: string, name: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('announcement-attachments')
        .download(path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const activeCount = announcements.filter(a => a.is_active).length;
  const pinnedCount = announcements.filter(a => a.is_pinned).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manage Announcements</h2>
          <p className="text-slate-600 mt-1">Create and manage company announcements</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Announcement
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-600 mb-1">Total Announcements</div>
          <div className="text-2xl font-bold text-slate-900">{announcements.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-600 mb-1">Active</div>
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-600 mb-1">Pinned</div>
          <div className="text-2xl font-bold text-amber-600">{pinnedCount}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <FileText className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-lg font-medium">No announcements yet</p>
            <p className="text-sm mt-1">Create your first announcement to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {announcements.map((announcement) => {
              const config = categoryConfig[announcement.category];
              const CategoryIcon = config.icon;

              return (
                <div key={announcement.id} className={`p-4 ${!announcement.is_active ? 'bg-slate-50 opacity-75' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                      <CategoryIcon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className={`font-semibold ${announcement.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
                          {announcement.title}
                        </h3>
                        {announcement.is_pinned && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                            <Pin className="w-3 h-3" /> Pinned
                          </span>
                        )}
                        {!announcement.is_active && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded-full">
                            Hidden
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.bgColor} ${config.textColor}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                        {announcement.content}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Created: {formatDate(announcement.created_at)}
                        </span>
                        {announcement.creator_name && (
                          <span>by {announcement.creator_name}</span>
                        )}
                        {announcement.expires_at && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-3.5 h-3.5" />
                            Expires: {formatDate(announcement.expires_at)}
                          </span>
                        )}
                        {announcement.attachment_name && announcement.attachment_path && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadAttachment(announcement.attachment_path!, announcement.attachment_name!);
                            }}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {announcement.attachment_name}
                            {announcement.attachment_size && ` (${formatFileSize(announcement.attachment_size)})`}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => togglePinned(announcement)}
                        className={`p-2 rounded-lg transition-colors ${
                          announcement.is_pinned
                            ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                            : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                        }`}
                        title={announcement.is_pinned ? 'Unpin' : 'Pin to top'}
                      >
                        {announcement.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => toggleActive(announcement)}
                        className={`p-2 rounded-lg transition-colors ${
                          announcement.is_active
                            ? 'hover:bg-slate-100 text-green-500 hover:text-green-600'
                            : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                        }`}
                        title={announcement.is_active ? 'Hide announcement' : 'Show announcement'}
                      >
                        {announcement.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openEditModal(announcement)}
                        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(announcement.id)}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {showDeleteConfirm === announcement.id && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800 font-medium mb-2">
                        Are you sure you want to delete this announcement?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteAnnouncement(announcement.id)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter announcement title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.entries(categoryConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: key as 'urgent' | 'informational' | 'procedural' })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.category === key
                            ? `${config.borderColor} ${config.bgColor}`
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-5 h-5 ${config.iconColor}`} />
                          <span className={`font-medium ${config.textColor}`}>{config.label}</span>
                        </div>
                        <p className="text-xs text-slate-500">{config.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter announcement content..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Attachment (Optional)
                </label>
                {existingAttachment && !removeAttachment && !selectedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <Paperclip className="w-5 h-5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{existingAttachment.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(existingAttachment.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadAttachment(existingAttachment.path, existingAttachment.name)}
                      className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoveAttachment(true)}
                      className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : selectedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Paperclip className="w-5 h-5 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-2 hover:bg-blue-100 text-blue-600 hover:text-blue-800 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id="file-upload"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <Paperclip className="w-5 h-5 text-slate-400" />
                      <span className="text-sm text-slate-600">Click to upload a document</span>
                    </label>
                    <p className="text-xs text-slate-500 mt-1">PDF, Word, Excel, images, or text files (max 10MB)</p>
                  </div>
                )}
                {removeAttachment && existingAttachment && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      Attachment will be removed when you save.
                      <button
                        type="button"
                        onClick={() => setRemoveAttachment(false)}
                        className="ml-2 text-amber-600 hover:text-amber-800 font-medium underline"
                      >
                        Undo
                      </button>
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Leave empty for no expiration</p>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_pinned}
                      onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-slate-700">Pin to top</span>
                      <p className="text-xs text-slate-500">Pinned announcements appear first</p>
                    </div>
                  </label>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {saving ? 'Saving...' : (editingAnnouncement ? 'Update Announcement' : 'Create Announcement')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
