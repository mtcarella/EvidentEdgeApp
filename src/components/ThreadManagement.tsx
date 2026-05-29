import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpDown, Clock, CalendarPlus, CalendarMinus, Eye, GripVertical,
  Archive, ArchiveRestore, ChevronDown, ChevronRight, Mail, MessageSquare,
  Paperclip, Users, User, Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type SortMode = 'recent_activity' | 'newest_first' | 'oldest_first' | 'unread_first' | 'manual';

interface ThreadItem {
  id: string;
  sent_by: string;
  communication_type: 'email' | 'sms';
  recipient_type: 'individual' | 'group';
  recipient_ids: string[];
  group_id: string | null;
  subject: string | null;
  message: string;
  sent_at: string;
  last_activity_at: string;
  is_archived: boolean;
  sender_name?: string;
  group_name?: string;
  reply_count?: number;
  attachment_count?: number;
  is_read?: boolean;
}

interface ThreadManagementProps {
  onThreadSelect: (threadId: string) => void;
}

const SORT_OPTIONS: { value: SortMode; label: string; icon: typeof Clock }[] = [
  { value: 'recent_activity', label: 'Recent Activity', icon: Clock },
  { value: 'newest_first', label: 'Newest First', icon: CalendarPlus },
  { value: 'oldest_first', label: 'Oldest First', icon: CalendarMinus },
  { value: 'unread_first', label: 'Unread First', icon: Eye },
  { value: 'manual', label: 'Custom Order', icon: GripVertical },
];

export function ThreadManagement({ onThreadSelect }: ThreadManagementProps) {
  const { user, salesPerson } = useAuth();
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('recent_activity');
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const prefsLoaded = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    loadPreferences();
    loadThreads();
    loadReadStatus();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('thread-management-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communication_logs' }, () => {
        loadThreads();
        loadReadStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('user_thread_preferences')
      .select('sort_mode, manual_order')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setSortMode(data.sort_mode as SortMode);
      setManualOrder(Array.isArray(data.manual_order) ? data.manual_order : []);
    }
    prefsLoaded.current = true;
  };

  const savePreferences = async (newSortMode: SortMode, newManualOrder?: string[]) => {
    if (!user?.id) return;
    setSavingPrefs(true);

    const order = newManualOrder ?? manualOrder;

    await supabase
      .from('user_thread_preferences')
      .upsert({
        user_id: user.id,
        sort_mode: newSortMode,
        manual_order: order,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    setSavingPrefs(false);
  };

  const loadReadStatus = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('communication_reads')
      .select('communication_id')
      .eq('user_id', user.id);

    if (data) {
      setReadSet(new Set(data.map(r => r.communication_id)));
    }
  };

  const loadThreads = async () => {
    if (!user?.id || !salesPerson) return;

    const isAdminUser = salesPerson?.role === 'admin' || salesPerson?.role === 'super_admin';

    let query = supabase
      .from('communication_logs')
      .select('id, sent_by, communication_type, recipient_type, recipient_ids, group_id, subject, message, sent_at, last_activity_at, is_archived')
      .is('reply_to_message_id', null);

    if (!isAdminUser) {
      query = query.or(`recipient_ids.cs.["${user.id}"],sent_by.eq.${user.id}`);
    }

    const { data: logs, error } = await query.order('last_activity_at', { ascending: false });

    if (error || !logs) {
      console.error('Error loading threads:', error);
      setLoading(false);
      return;
    }

    const threadItems: ThreadItem[] = await Promise.all(
      logs.map(async (log) => {
        const { data: senderData } = await supabase
          .from('sales_people')
          .select('name')
          .eq('user_id', log.sent_by)
          .maybeSingle();

        let groupName = null;
        if (log.group_id) {
          const { data: groupData } = await supabase
            .from('user_groups')
            .select('name')
            .eq('id', log.group_id)
            .maybeSingle();
          groupName = groupData?.name || null;
        }

        const { count: replyCount } = await supabase
          .from('communication_logs')
          .select('id', { count: 'exact', head: true })
          .eq('reply_to_message_id', log.id);

        const { count: attachmentCount } = await supabase
          .from('communication_attachments')
          .select('id', { count: 'exact', head: true })
          .eq('communication_id', log.id);

        return {
          ...log,
          sender_name: senderData?.name || 'Unknown',
          group_name: groupName,
          reply_count: replyCount || 0,
          attachment_count: attachmentCount || 0,
        };
      })
    );

    setThreads(threadItems);
    setLoading(false);
  };

  const handleSortChange = (newMode: SortMode) => {
    setSortMode(newMode);
    savePreferences(newMode);
  };

  const handleArchiveThread = async (threadId: string, archive: boolean) => {
    await supabase
      .from('communication_logs')
      .update({ is_archived: archive })
      .eq('id', threadId);

    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, is_archived: archive } : t));
  };

  const handleDragStart = (e: React.DragEvent, threadId: string) => {
    if (sortMode !== 'manual') return;
    setDraggedId(threadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', threadId);
  };

  const handleDragOver = (e: React.DragEvent, threadId: string) => {
    if (sortMode !== 'manual') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (threadId !== draggedId) {
      setDragOverId(threadId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (sortMode !== 'manual') return;
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const activeThreads = getSortedThreads(false);
    const ids = activeThreads.map(t => t.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      return;
    }

    const newOrder = [...ids];
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, draggedId);

    setManualOrder(newOrder);
    savePreferences(sortMode, newOrder);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const getSortedThreads = useCallback((archived: boolean) => {
    const filtered = threads.filter(t => t.is_archived === archived);

    if (archived) {
      return filtered.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
    }

    switch (sortMode) {
      case 'recent_activity':
        return filtered.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
      case 'newest_first':
        return filtered.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
      case 'oldest_first':
        return filtered.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
      case 'unread_first': {
        return filtered.sort((a, b) => {
          const aRead = readSet.has(a.id);
          const bRead = readSet.has(b.id);
          if (aRead !== bRead) return aRead ? 1 : -1;
          return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
        });
      }
      case 'manual': {
        if (manualOrder.length === 0) {
          return filtered.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
        }
        return filtered.sort((a, b) => {
          const aIdx = manualOrder.indexOf(a.id);
          const bIdx = manualOrder.indexOf(b.id);
          if (aIdx === -1 && bIdx === -1) return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      }
      default:
        return filtered;
    }
  }, [threads, sortMode, manualOrder, readSet]);

  const activeThreads = getSortedThreads(false);
  const archivedThreads = getSortedThreads(true);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading threads...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <SortControls
        sortMode={sortMode}
        onSortChange={handleSortChange}
        saving={savingPrefs}
      />

      {/* Active Threads */}
      {activeThreads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No active threads</p>
          <p className="text-sm mt-1">Messages you send or receive will appear here</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activeThreads.map(thread => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              isRead={readSet.has(thread.id)}
              isManualMode={sortMode === 'manual'}
              isDragging={draggedId === thread.id}
              isDragOver={dragOverId === thread.id}
              onSelect={() => onThreadSelect(thread.id)}
              onArchive={() => handleArchiveThread(thread.id, true)}
              onDragStart={(e) => handleDragStart(e, thread.id)}
              onDragOver={(e) => handleDragOver(e, thread.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, thread.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {/* Archived Section */}
      {archivedThreads.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {showArchived ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <Archive className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">
              Archived Threads ({archivedThreads.length})
            </span>
          </button>

          {showArchived && (
            <div className="mt-2 space-y-1 opacity-75">
              {archivedThreads.map(thread => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  isRead={readSet.has(thread.id)}
                  isManualMode={false}
                  isDragging={false}
                  isDragOver={false}
                  onSelect={() => onThreadSelect(thread.id)}
                  onArchive={() => handleArchiveThread(thread.id, false)}
                  onDragStart={() => {}}
                  onDragOver={() => {}}
                  onDragLeave={() => {}}
                  onDrop={() => {}}
                  onDragEnd={() => {}}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sort Controls ---

interface SortControlsProps {
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  saving: boolean;
}

function SortControls({ sortMode, onSortChange, saving }: SortControlsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOption = SORT_OPTIONS.find(o => o.value === sortMode) || SORT_OPTIONS[0];
  const CurrentIcon = currentOption.icon;

  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <ArrowUpDown className="w-4 h-4" />
        <span className="font-medium">Sort:</span>
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
        >
          <CurrentIcon className="w-3.5 h-3.5" />
          {currentOption.label}
          {sortMode === 'manual' && (
            <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
              Manual
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
            {SORT_OPTIONS.map(option => {
              const Icon = option.icon;
              const isActive = sortMode === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{option.label}</span>
                  {isActive && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              );
            })}
            {sortMode === 'manual' && (
              <div className="px-4 py-2 border-t border-gray-100 bg-amber-50">
                <p className="text-xs text-amber-700">
                  Drag threads to reorder. Auto-sort is disabled.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {saving && (
        <span className="text-xs text-gray-400 animate-pulse">Saving...</span>
      )}
    </div>
  );
}

// --- Thread Card ---

interface ThreadCardProps {
  thread: ThreadItem;
  isRead: boolean;
  isManualMode: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  isArchived?: boolean;
  onSelect: () => void;
  onArchive: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function ThreadCard({
  thread,
  isRead,
  isManualMode,
  isDragging,
  isDragOver,
  isArchived,
  onSelect,
  onArchive,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: ThreadCardProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      draggable={isManualMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative flex items-start gap-3 px-4 py-3 rounded-lg border transition-all cursor-pointer ${
        isDragging ? 'opacity-40 scale-95' : ''
      } ${
        isDragOver ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : ''
      } ${
        isRead
          ? 'bg-white border-gray-150 hover:border-gray-300 hover:shadow-sm'
          : 'bg-blue-50/50 border-blue-200 hover:border-blue-300 hover:shadow-sm'
      }`}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      {isManualMode && (
        <div className="flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      {/* Unread Indicator */}
      {!isRead && (
        <div className="flex-shrink-0 mt-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
        </div>
      )}

      {/* Type Icon */}
      <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded-md ${
        thread.communication_type === 'email' ? 'bg-sky-100 text-sky-600' : 'bg-green-100 text-green-600'
      }`}>
        {thread.communication_type === 'email' ? (
          <Mail className="w-4 h-4" />
        ) : (
          <MessageSquare className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate ${isRead ? 'text-gray-900' : 'text-gray-900 font-semibold'}`}>
            {thread.subject || '(No subject)'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500 truncate">
            {thread.sender_name}
          </span>
          {thread.group_name && (
            <>
              <span className="text-gray-300">-</span>
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {thread.group_name}
              </span>
            </>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
          {thread.message}
        </p>
      </div>

      {/* Metadata */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <span className="text-xs text-gray-400">{formatTime(thread.last_activity_at)}</span>
        <div className="flex items-center gap-2">
          {(thread.reply_count || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-500">
              <MessageSquare className="w-3 h-3" />
              {thread.reply_count}
            </span>
          )}
          {(thread.attachment_count || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-500">
              <Paperclip className="w-3 h-3" />
              {thread.attachment_count}
            </span>
          )}
        </div>
      </div>

      {/* Archive Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
        title={isArchived ? 'Restore thread' : 'Archive thread'}
        className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
      >
        {isArchived ? (
          <ArchiveRestore className="w-4 h-4" />
        ) : (
          <Archive className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
