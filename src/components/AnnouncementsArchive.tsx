import { useState, useEffect } from 'react';
import { Search, Filter, Pin, AlertTriangle, Info, FileText, Calendar, Clock, ChevronDown, ChevronUp, User, Eye, EyeOff, ArrowUpDown, Paperclip, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'urgent' | 'informational' | 'procedural';
  is_pinned: boolean;
  created_at: string;
  created_by: string;
  creator_name?: string;
  attachment_name?: string | null;
  attachment_path?: string | null;
  attachment_size?: number | null;
}

const categoryConfig = {
  urgent: {
    icon: AlertTriangle,
    label: 'Urgent',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconColor: 'text-red-500',
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
  },
  informational: {
    icon: Info,
    label: 'Informational',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    iconColor: 'text-blue-500',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  procedural: {
    icon: FileText,
    label: 'Procedural',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    iconColor: 'text-amber-500',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
};

type SortField = 'created_at' | 'title' | 'category';
type SortDirection = 'asc' | 'desc';

export function AnnouncementsArchive() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAnnouncements();
      fetchReadStatus();
    }
  }, [user]);

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

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        markAsRead(id);
      }
      return newSet;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedAnnouncements = announcements
    .filter(a => {
      const matchesSearch = searchTerm === '' ||
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
      const matchesRead = readFilter === 'all' ||
        (readFilter === 'read' && readAnnouncements.has(a.id)) ||
        (readFilter === 'unread' && !readAnnouncements.has(a.id));

      const announcementDate = new Date(a.created_at);
      const matchesDateFrom = !dateFrom || announcementDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || announcementDate <= new Date(dateTo + 'T23:59:59');

      return matchesSearch && matchesCategory && matchesRead && matchesDateFrom && matchesDateTo;
    })
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;

      let comparison = 0;
      switch (sortField) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
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

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setReadFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = searchTerm || categoryFilter !== 'all' || readFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Announcements Archive</h2>
            <p className="text-slate-600 mt-1">Browse all procedural updates and company announcements</p>
          </div>
          <div className="text-sm text-slate-500">
            {filteredAndSortedAnnouncements.length} of {announcements.length} announcements
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search announcements by title or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-300 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-xs rounded-full">
                {[categoryFilter !== 'all', readFilter !== 'all', dateFrom, dateTo].filter(Boolean).length}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Read Status</label>
                <select
                  value={readFilter}
                  onChange={(e) => setReadFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread Only</option>
                  <option value="read">Read Only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-600">
        <div className="col-span-1"></div>
        <button
          onClick={() => handleSort('title')}
          className="col-span-5 flex items-center gap-1 hover:text-slate-900"
        >
          Title
          {sortField === 'title' && (
            <ArrowUpDown className={`w-4 h-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
          )}
        </button>
        <button
          onClick={() => handleSort('category')}
          className="col-span-2 flex items-center gap-1 hover:text-slate-900"
        >
          Category
          {sortField === 'category' && (
            <ArrowUpDown className={`w-4 h-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
          )}
        </button>
        <button
          onClick={() => handleSort('created_at')}
          className="col-span-3 flex items-center gap-1 hover:text-slate-900"
        >
          Date
          {sortField === 'created_at' && (
            <ArrowUpDown className={`w-4 h-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
          )}
        </button>
        <div className="col-span-1 text-center">Status</div>
      </div>

      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredAndSortedAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <FileText className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-lg font-medium">No announcements found</p>
            <p className="text-sm mt-1">
              {hasActiveFilters ? 'Try adjusting your search or filters' : 'No announcements have been posted yet'}
            </p>
          </div>
        ) : (
          filteredAndSortedAnnouncements.map((announcement) => {
            const config = categoryConfig[announcement.category];
            const CategoryIcon = config.icon;
            const isRead = readAnnouncements.has(announcement.id);
            const isExpanded = expandedIds.has(announcement.id);

            return (
              <div
                key={announcement.id}
                className={`${!isRead ? 'bg-blue-50/30' : ''}`}
              >
                <button
                  onClick={() => toggleExpanded(announcement.id)}
                  className="w-full grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="md:col-span-1 flex items-center gap-2 md:gap-0">
                    <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <CategoryIcon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    {announcement.is_pinned && (
                      <Pin className="w-4 h-4 text-amber-500 md:hidden" />
                    )}
                  </div>
                  <div className="md:col-span-5 flex items-center gap-2">
                    {announcement.is_pinned && (
                      <Pin className="w-4 h-4 text-amber-500 hidden md:block flex-shrink-0" />
                    )}
                    <span className={`font-medium ${!isRead ? 'text-slate-900' : 'text-slate-700'} line-clamp-1`}>
                      {announcement.title}
                    </span>
                    {announcement.attachment_name && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex-shrink-0">
                        <Paperclip className="w-3 h-3" />
                        <span className="hidden sm:inline">Attachment</span>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2 flex items-center">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${config.badgeColor}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="md:col-span-3 flex items-center text-sm text-slate-600">
                    <Calendar className="w-4 h-4 mr-1.5 text-slate-400" />
                    {formatDate(announcement.created_at)}
                  </div>
                  <div className="md:col-span-1 flex items-center justify-center">
                    {isRead ? (
                      <Eye className="w-4 h-4 text-green-500" title="Read" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-slate-400" title="Unread" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-4">
                    <div className={`p-4 rounded-lg border ${config.borderColor} ${config.bgColor}`}>
                      <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {announcement.content}
                      </p>
                      {announcement.attachment_name && announcement.attachment_path && (
                        <div className="mt-4">
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg">
                            <Paperclip className="w-4 h-4" />
                            <div className="flex-1 text-left">
                              <p className="font-medium text-sm">{announcement.attachment_name}</p>
                              {announcement.attachment_size && (
                                <p className="text-xs text-slate-500">{formatFileSize(announcement.attachment_size)}</p>
                              )}
                            </div>
                            <button
                              onClick={(e) => viewAttachment(announcement.attachment_path!, e)}
                              className="p-2 hover:bg-slate-100 text-slate-600 rounded transition-colors"
                              title="View attachment"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => downloadAttachment(announcement.attachment_path!, announcement.attachment_name!, e)}
                              className="p-2 hover:bg-slate-100 text-slate-600 rounded transition-colors"
                              title="Download attachment"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {formatTime(announcement.created_at)}
                        </div>
                        {announcement.creator_name && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-slate-400" />
                            Posted by {announcement.creator_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
