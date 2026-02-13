import { useState, useEffect } from 'react';
import { X, AlertTriangle, Info, FileText, ChevronLeft, ChevronRight, Bell, Check, Paperclip, Download, Eye, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'urgent' | 'informational' | 'procedural';
  is_pinned: boolean;
  created_at: string;
  attachment_name?: string | null;
  attachment_path?: string | null;
  attachment_size?: number | null;
}

const categoryConfig = {
  urgent: {
    icon: AlertTriangle,
    label: 'Time Sensitive',
    bgGradient: 'from-red-500 to-red-600',
    lightBg: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
    accentColor: 'bg-red-500',
    buttonBg: 'bg-red-600 hover:bg-red-700',
  },
  informational: {
    icon: Info,
    label: 'Informational',
    bgGradient: 'from-blue-500 to-blue-600',
    lightBg: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    accentColor: 'bg-blue-500',
    buttonBg: 'bg-blue-600 hover:bg-blue-700',
  },
  procedural: {
    icon: FileText,
    label: 'Procedural',
    bgGradient: 'from-amber-500 to-amber-600',
    lightBg: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    accentColor: 'bg-amber-500',
    buttonBg: 'bg-amber-600 hover:bg-amber-700',
  },
};

interface LoginAnnouncementsModalProps {
  onClose: () => void;
}

export function LoginAnnouncementsModal({ onClose }: LoginAnnouncementsModalProps) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUnreadAnnouncements();
    }
  }, [user]);

  const fetchUnreadAnnouncements = async () => {
    if (!user) return;

    try {
      const { data: readIds } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      const readSet = new Set((readIds || []).map(r => r.announcement_id));

      const { data: allAnnouncements, error } = await supabase
        .from('announcements')
        .select('id, title, content, category, is_pinned, created_at, attachment_name, attachment_path, attachment_size')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('is_pinned', { ascending: false })
        .order('category', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const unread = (allAnnouncements || []).filter(a => !readSet.has(a.id));

      const sortedUnread = unread.sort((a, b) => {
        const priorityOrder = { urgent: 0, procedural: 1, informational: 2 };
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return priorityOrder[a.category] - priorityOrder[b.category];
      });

      setAnnouncements(sortedUnread);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const markCurrentAsRead = async () => {
    if (!user || announcements.length === 0) return;

    const currentAnnouncement = announcements[currentIndex];

    try {
      await supabase
        .from('announcement_reads')
        .upsert({ announcement_id: currentAnnouncement.id, user_id: user.id }, { onConflict: 'announcement_id,user_id' });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || announcements.length === 0) return;

    setMarkingRead(true);
    try {
      const inserts = announcements.map(a => ({ announcement_id: a.id, user_id: user.id }));
      await supabase
        .from('announcement_reads')
        .upsert(inserts, { onConflict: 'announcement_id,user_id' });
      onClose();
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setMarkingRead(false);
    }
  };

  const handleNext = async () => {
    await markCurrentAsRead();
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleDismiss = async () => {
    await markAllAsRead();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const viewAttachment = async (path: string) => {
    try {
      const { data } = await supabase.storage
        .from('announcement-attachments')
        .getPublicUrl(path);

      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing file:', error);
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-slate-600">Loading announcements...</span>
          </div>
        </div>
      </div>
    );
  }

  if (announcements.length === 0) {
    return null;
  }

  const currentAnnouncement = announcements[currentIndex];
  const config = categoryConfig[currentAnnouncement.category];
  const CategoryIcon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className={`bg-gradient-to-r ${config.bgGradient} px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">New Announcements</h2>
              <p className="text-white/80 text-sm">
                {announcements.length} unread announcement{announcements.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            disabled={markingRead}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors group"
            title="Dismiss all"
          >
            <X className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {announcements.length > 1 && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {announcements.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    idx === currentIndex
                      ? `${config.accentColor} w-6`
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-slate-500 font-medium">
              {currentIndex + 1} of {announcements.length}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={`flex-shrink-0 w-12 h-12 ${config.iconBg} rounded-xl flex items-center justify-center`}>
              <CategoryIcon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badgeColor}`}>
                  <CategoryIcon className="w-3.5 h-3.5" />
                  {config.label}
                </span>
                {currentAnnouncement.is_pinned && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-medium">
                    Pinned
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                {currentAnnouncement.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock className="w-4 h-4" />
                {formatDate(currentAnnouncement.created_at)}
              </div>
            </div>
          </div>

          <div className={`${config.lightBg} ${config.borderColor} border rounded-xl p-5 mb-4`}>
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
              {currentAnnouncement.content}
            </p>
          </div>

          {currentAnnouncement.attachment_name && currentAnnouncement.attachment_path && (
            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Paperclip className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{currentAnnouncement.attachment_name}</p>
                {currentAnnouncement.attachment_size && (
                  <p className="text-sm text-slate-500">{formatFileSize(currentAnnouncement.attachment_size)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => viewAttachment(currentAnnouncement.attachment_path!)}
                  className="p-2 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  title="View"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={() => downloadAttachment(currentAnnouncement.attachment_path!, currentAnnouncement.attachment_name!)}
                  className="p-2 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
          <button
            onClick={handleDismiss}
            disabled={markingRead}
            className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors font-medium disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">Mark All Read & Close</span>
            <span className="sm:hidden">Dismiss All</span>
          </button>

          <div className="flex items-center gap-2">
            {announcements.length > 1 && (
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 px-3 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Previous</span>
              </button>
            )}
            <button
              onClick={handleNext}
              className={`flex items-center gap-2 px-5 py-2.5 ${config.buttonBg} text-white rounded-xl transition-colors font-medium shadow-lg shadow-${currentAnnouncement.category === 'urgent' ? 'red' : currentAnnouncement.category === 'informational' ? 'blue' : 'amber'}-500/25`}
            >
              {currentIndex === announcements.length - 1 ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
