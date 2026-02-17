import { useState, useEffect, useRef } from 'react';
import { Bell, X, Search, Filter, Pin, AlertTriangle, Info, FileText, Check, ChevronDown, Calendar, Clock, Paperclip, Download, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'time sensitive' | 'informational' | 'procedural';
  is_pinned: boolean;
  created_at: string;
  created_by: string;
  creator_name?: string;
  attachment_name?: string | null;
  attachment_path?: string | null;
  attachment_size?: number | null;
}

interface AnnouncementRead {
  announcement_id: string;
  read_at: string;
}

const categoryConfig = {
  'time sensitive': {
    icon: AlertTriangle,
    label: 'Time Sensitive',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconColor: 'text-red-500',
    badgeColor: 'bg-red-100 text-red-800',
  },
  informational: {
    icon: Info,
    label: 'Informational',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    iconColor: 'text-blue-500',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  procedural: {
    icon: FileText,
    label: 'Procedural',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    iconColor: 'text-amber-500',
    badgeColor: 'bg-amber-100 text-amber-800',
  },
};

interface AnnouncementsProps {
  onNavigateToAnnouncements?: () => void;
}

export function Announcements({ onNavigateToAnnouncements }: AnnouncementsProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const unreadCount = announcements.filter(a => !readAnnouncements.has(a.id)).length;

  useEffect(() => {
    if (user) {
      fetchAnnouncements();
      fetchReadStatus();
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        const bellButton = document.getElementById('announcements-bell');
        if (bellButton && !bellButton.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          id,
          title,
          content,
          category,
          is_pinned,
          created_at,
          created_by,
          attachment_name,
          attachment_path,
          attachment_size
        `)
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()')
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

  const fetchReadStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      if (error) throw error;

      setReadAnnouncements(new Set((data || []).map(r => r.announcement_id)));
    } catch (error) {
      console.error('Error fetching read status:', error);
    }
  };

  const markAsRead = async (announcementId: string) => {
    if (!user || readAnnouncements.has(announcementId)) return;

    try {
      const { error } = await supabase
        .from('announcement_reads')
        .insert({ announcement_id: announcementId, user_id: user.id });

      if (error && error.code !== '23505') throw error;

      setReadAnnouncements(prev => new Set([...prev, announcementId]));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const unreadIds = announcements
      .filter(a => !readAnnouncements.has(a.id))
      .map(a => a.id);

    if (unreadIds.length === 0) return;

    try {
      const inserts = unreadIds.map(id => ({ announcement_id: id, user_id: user.id }));
      const { error } = await supabase
        .from('announcement_reads')
        .upsert(inserts, { onConflict: 'announcement_id,user_id' });

      if (error) throw error;

      setReadAnnouncements(prev => new Set([...prev, ...unreadIds]));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const filteredAnnouncements = announcements.filter(a => {
    const matchesSearch = searchTerm === '' ||
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
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

  const viewAttachment = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const downloadAttachment = async (path: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <>
      <button
        id="announcements-bell"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
        title="Announcements"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[420px] max-h-[80vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col"
        >
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Announcements</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search announcements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
                    categoryFilter !== 'all'
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showFilterDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-10">
                    <button
                      onClick={() => { setCategoryFilter('all'); setShowFilterDropdown(false); }}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 ${categoryFilter === 'all' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      All Categories
                    </button>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => { setCategoryFilter(key); setShowFilterDropdown(false); }}
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 ${categoryFilter === key ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        <config.icon className={`w-4 h-4 ${config.iconColor}`} />
                        {config.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[calc(80vh-200px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Bell className="w-12 h-12 mb-3 text-slate-300" />
                <p className="font-medium">No announcements</p>
                <p className="text-sm">
                  {searchTerm || categoryFilter !== 'all' ? 'Try adjusting your filters' : 'Check back later for updates'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredAnnouncements.map((announcement) => {
                  const config = categoryConfig[announcement.category];
                  const CategoryIcon = config.icon;
                  const isRead = readAnnouncements.has(announcement.id);
                  const isExpanded = expandedAnnouncement === announcement.id;

                  return (
                    <div
                      key={announcement.id}
                      onClick={() => {
                        if (announcement.attachment_name && announcement.attachment_path) {
                          if (!isRead) markAsRead(announcement.id);
                          if (onNavigateToAnnouncements) {
                            setIsOpen(false);
                            onNavigateToAnnouncements();
                          }
                        } else {
                          setExpandedAnnouncement(isExpanded ? null : announcement.id);
                          if (!isRead) markAsRead(announcement.id);
                        }
                      }}
                      className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${
                        !isRead ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                          <CategoryIcon className={`w-5 h-5 ${config.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {announcement.is_pinned && (
                              <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            )}
                            {!isRead && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                            )}
                            <h4 className={`font-semibold text-slate-900 truncate ${!isRead ? 'text-slate-900' : 'text-slate-700'}`}>
                              {announcement.title}
                            </h4>
                            {announcement.attachment_name && announcement.attachment_path && (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex-shrink-0">
                                <Paperclip className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          <p className={`text-sm text-slate-600 ${isExpanded ? '' : 'line-clamp-2'}`}>
                            {announcement.content}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full ${config.badgeColor}`}>
                              {config.label}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(announcement.created_at)}
                            </span>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-2">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatFullDate(announcement.created_at)}
                              </div>
                              {announcement.creator_name && (
                                <div className="mt-1">
                                  Posted by: {announcement.creator_name}
                                </div>
                              )}
                              {announcement.attachment_name && announcement.attachment_path && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                                  <Paperclip className="w-4 h-4 text-blue-700" />
                                  <div className="flex-1 text-left">
                                    <p className="font-medium text-sm text-blue-700">{announcement.attachment_name}</p>
                                    {announcement.attachment_size && (
                                      <p className="text-xs text-blue-600">{formatFileSize(announcement.attachment_size)}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => viewAttachment(announcement.attachment_path!, e)}
                                    className="p-1.5 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                                    title="View attachment"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => downloadAttachment(announcement.attachment_path!, announcement.attachment_name!, e)}
                                    className="p-1.5 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                                    title="Download attachment"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
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

          {onNavigateToAnnouncements && !loading && announcements.length > 0 && (
            <div className="border-t border-slate-200 p-3">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToAnnouncements();
                }}
                className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                View All Announcements
                <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
