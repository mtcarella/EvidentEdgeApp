import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Search, Send, ArrowLeft, Check, CheckCheck, Book, X, Mail, Phone, Users, UserPlus, Trash2, Clock, Coffee, Briefcase, Calendar, Palmtree, Settings, AlertCircle, Circle, MinusCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  cell_phone?: string;
}

interface Conversation {
  id: string;
  last_message_at: string;
  other_user_id: string;
  other_user_name: string;
  other_user_email: string;
  last_message?: string;
  unread_count: number;
  is_group?: boolean;
  group_name?: string;
  participant_names?: string[];
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_name?: string;
}

interface NewMessageNotification {
  id: string;
  senderName: string;
  content: string;
  conversationId: string;
  timestamp: Date;
}

interface OutOfOfficeStatus {
  id: string;
  user_id: string;
  is_enabled: boolean;
  status_type: 'lunch' | 'out_of_office' | 'meeting' | 'vacation' | 'custom';
  custom_message: string | null;
  start_time: string | null;
  end_time: string | null;
  auto_disable: boolean;
}

interface UserPresence {
  user_id: string;
  status: 'online' | 'offline' | 'do_not_disturb';
  last_seen: string;
}

type SidebarView = 'conversations' | 'phonebook';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  salesperson: 'Sales',
  closer: 'Closer',
  processor: 'Processor',
  sales_processor: 'Sales Processor'
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-amber-100 text-amber-800',
  salesperson: 'bg-blue-100 text-blue-800',
  closer: 'bg-emerald-100 text-emerald-800',
  processor: 'bg-teal-100 text-teal-800',
  sales_processor: 'bg-cyan-100 text-cyan-800'
};

const avatarColors: Record<string, string> = {
  super_admin: 'from-purple-500 to-purple-600',
  admin: 'from-amber-500 to-amber-600',
  salesperson: 'from-blue-500 to-blue-600',
  closer: 'from-emerald-500 to-emerald-600',
  processor: 'from-teal-500 to-teal-600',
  sales_processor: 'from-cyan-500 to-cyan-600'
};

export function DirectMessages() {
  const { user, chatEnabled } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [sidebarView, setSidebarView] = useState<SidebarView>('conversations');
  const [searchTerm, setSearchTerm] = useState('');
  const [phonebookSearchTerm, setPhonebookSearchTerm] = useState('');
  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [notifications, setNotifications] = useState<NewMessageNotification[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [outOfOfficeStatuses, setOutOfOfficeStatuses] = useState<Record<string, OutOfOfficeStatus>>({});
  const [showOOOSettings, setShowOOOSettings] = useState(false);
  const [myOOOStatus, setMyOOOStatus] = useState<OutOfOfficeStatus | null>(null);
  const [oooFormData, setOOOFormData] = useState({
    is_enabled: false,
    status_type: 'out_of_office' as OutOfOfficeStatus['status_type'],
    custom_message: '',
    end_time: '',
    auto_disable: true
  });
  const [savingOOO, setSavingOOO] = useState(false);
  const [userPresence, setUserPresence] = useState<Record<string, UserPresence>>({});
  const [myPresenceStatus, setMyPresenceStatus] = useState<'online' | 'do_not_disturb'>('online');
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const quickSearchRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchUsers();
    fetchOutOfOfficeStatuses();
    fetchMyOOOStatus();
    fetchUserPresence();

    updateMyPresence('online');
    presenceIntervalRef.current = setInterval(() => {
      updateMyPresence(myPresenceStatus);
    }, 30000);

    const handleBeforeUnload = () => {
      supabase.rpc('set_user_offline');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      supabase.rpc('set_user_offline');
    };
  }, [user?.id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      markMessagesAsRead(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id || m.id.startsWith('temp-'))) return prev;
            return [...prev, { ...newMsg, is_read: newMsg.sender_id === user?.id }];
          });
          if (newMsg.sender_id !== user?.id) {
            markMessagesAsRead(selectedConversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('conversations_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages'
        },
        async (payload) => {
          const newMsg = payload.new as Message & { conversation_id: string };

          if (newMsg.sender_id !== user.id) {
            if (!selectedConversation || selectedConversation.id !== newMsg.conversation_id) {
              const sender = users.find(u => u.user_id === newMsg.sender_id);
              const senderName = sender?.name || 'Someone';

              const notification: NewMessageNotification = {
                id: newMsg.id,
                senderName,
                content: newMsg.content,
                conversationId: newMsg.conversation_id,
                timestamp: new Date()
              };

              setNotifications(prev => [...prev, notification]);

              setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
              }, 5000);
            }
          }

          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedConversation?.id, users]);

  useEffect(() => {
    const channel = supabase
      .channel('presence_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        () => {
          fetchUserPresence();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (showQuickSearch && quickSearchRef.current) {
      quickSearchRef.current.focus();
    }
  }, [showQuickSearch]);

  const fetchConversations = async () => {
    if (!user?.id) return;

    setLoading(true);

    const { data: participations, error: partError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (partError || !participations?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = participations.map(p => p.conversation_id);

    const [convResult, allParticipantsResult, lastMessagesResult, allIncomingMessagesResult, readMessagesResult, allUsersResult] = await Promise.all([
      supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false }),
      supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds),
      supabase
        .from('direct_messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('direct_messages')
        .select('id, conversation_id')
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id),
      supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id),
      supabase
        .from('sales_people')
        .select('user_id, name, email')
        .eq('is_active', true)
    ]);

    if (convResult.error || !convResult.data) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const participantsByConv = new Map<string, string[]>();
    allParticipantsResult.data?.forEach(p => {
      const existing = participantsByConv.get(p.conversation_id) || [];
      existing.push(p.user_id);
      participantsByConv.set(p.conversation_id, existing);
    });

    const lastMessageByConv = new Map<string, string>();
    const seenConvs = new Set<string>();
    lastMessagesResult.data?.forEach(m => {
      if (!seenConvs.has(m.conversation_id)) {
        lastMessageByConv.set(m.conversation_id, m.content);
        seenConvs.add(m.conversation_id);
      }
    });

    const messagesByConv = new Map<string, string[]>();
    allIncomingMessagesResult.data?.forEach(m => {
      const existing = messagesByConv.get(m.conversation_id) || [];
      existing.push(m.id);
      messagesByConv.set(m.conversation_id, existing);
    });

    const readMessageIds = new Set(readMessagesResult.data?.map(r => r.message_id) || []);

    const usersMap = new Map<string, { name: string; email: string }>();
    allUsersResult.data?.forEach(u => {
      usersMap.set(u.user_id, { name: u.name, email: u.email });
    });

    const conversationsWithDetails = convResult.data.map(conv => {
      const allParticipants = participantsByConv.get(conv.id) || [];
      const otherParticipants = allParticipants.filter(uid => uid !== user.id);
      const isGroup = conv.is_group || otherParticipants.length > 1;

      let otherUserName = 'Unknown';
      let otherUserEmail = '';
      let otherUserId = '';
      let participantNames: string[] = [];

      if (isGroup) {
        participantNames = otherParticipants.map(uid => usersMap.get(uid)?.name || 'Unknown');
        otherUserName = conv.group_name || participantNames.slice(0, 3).join(', ') + (participantNames.length > 3 ? ` +${participantNames.length - 3}` : '');
        otherUserEmail = `${participantNames.length} participants`;
      } else {
        otherUserId = otherParticipants[0] || '';
        const userData = usersMap.get(otherUserId);
        if (userData) {
          otherUserName = userData.name;
          otherUserEmail = userData.email;
        }
      }

      const incomingMsgIds = messagesByConv.get(conv.id) || [];
      const unreadCount = incomingMsgIds.filter(id => !readMessageIds.has(id)).length;

      return {
        id: conv.id,
        last_message_at: conv.last_message_at,
        other_user_id: otherUserId,
        other_user_name: otherUserName,
        other_user_email: otherUserEmail,
        last_message: lastMessageByConv.get(conv.id),
        unread_count: unreadCount,
        is_group: isGroup,
        group_name: conv.group_name,
        participant_names: participantNames
      };
    });

    setConversations(conversationsWithDetails);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('sales_people')
      .select('id, user_id, name, email, role, cell_phone, chat_enabled')
      .eq('is_active', true)
      .eq('chat_enabled', true)
      .order('name');

    if (!error && data) {
      setUsers(data.filter(u => u.user_id !== user?.id));
    }
  };

  const fetchOutOfOfficeStatuses = async () => {
    const { data, error } = await supabase
      .from('user_out_of_office')
      .select('*')
      .eq('is_enabled', true);

    if (!error && data) {
      const statusMap: Record<string, OutOfOfficeStatus> = {};
      data.forEach(status => {
        if (status.end_time) {
          const endTime = new Date(status.end_time);
          if (endTime > new Date()) {
            statusMap[status.user_id] = status;
          }
        } else {
          statusMap[status.user_id] = status;
        }
      });
      setOutOfOfficeStatuses(statusMap);
    }
  };

  const fetchMyOOOStatus = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('user_out_of_office')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setMyOOOStatus(data);
      setOOOFormData({
        is_enabled: data.is_enabled,
        status_type: data.status_type,
        custom_message: data.custom_message || '',
        end_time: data.end_time ? new Date(data.end_time).toISOString().slice(0, 16) : '',
        auto_disable: data.auto_disable
      });
    }
  };

  const fetchUserPresence = async () => {
    const { data, error } = await supabase
      .from('user_presence')
      .select('*');

    if (!error && data) {
      const presenceMap: Record<string, UserPresence> = {};
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      data.forEach(p => {
        const lastSeen = new Date(p.last_seen);
        const isStale = lastSeen < twoMinutesAgo;
        presenceMap[p.user_id] = {
          ...p,
          status: isStale && p.status === 'online' ? 'offline' : p.status
        };
      });
      setUserPresence(presenceMap);

      const myPresence = data.find(p => p.user_id === user?.id);
      if (myPresence && myPresence.status !== 'offline') {
        setMyPresenceStatus(myPresence.status as 'online' | 'do_not_disturb');
      }
    }
  };

  const updateMyPresence = async (status: 'online' | 'do_not_disturb') => {
    if (!user?.id) return;

    await supabase.rpc('update_user_presence', { p_status: status });
    setMyPresenceStatus(status);
    fetchUserPresence();
  };

  const getPresenceIndicator = (userId: string) => {
    const presence = userPresence[userId];
    if (!presence) return { color: 'bg-slate-400', label: 'Offline', icon: Circle };

    switch (presence.status) {
      case 'online':
        return { color: 'bg-green-500', label: 'Online', icon: Circle };
      case 'do_not_disturb':
        return { color: 'bg-red-500', label: 'Do Not Disturb', icon: MinusCircle };
      default:
        return { color: 'bg-slate-400', label: 'Offline', icon: Circle };
    }
  };

  const saveOOOStatus = async () => {
    if (!user?.id) return;

    setSavingOOO(true);

    const statusData = {
      user_id: user.id,
      is_enabled: oooFormData.is_enabled,
      status_type: oooFormData.status_type,
      custom_message: oooFormData.custom_message || null,
      start_time: oooFormData.is_enabled ? new Date().toISOString() : null,
      end_time: oooFormData.end_time ? new Date(oooFormData.end_time).toISOString() : null,
      auto_disable: oooFormData.auto_disable,
      updated_at: new Date().toISOString()
    };

    let error;
    if (myOOOStatus) {
      const { error: updateError } = await supabase
        .from('user_out_of_office')
        .update(statusData)
        .eq('user_id', user.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('user_out_of_office')
        .insert(statusData);
      error = insertError;
    }

    if (!error) {
      await fetchMyOOOStatus();
      await fetchOutOfOfficeStatuses();
      setShowOOOSettings(false);
    } else {
      console.error('Error saving OOO status:', error);
    }

    setSavingOOO(false);
  };

  const getOOOStatusInfo = (status: OutOfOfficeStatus) => {
    const statusConfig = {
      lunch: { icon: Coffee, label: 'At Lunch', color: 'bg-amber-100 text-amber-800 border-amber-300' },
      out_of_office: { icon: Briefcase, label: 'Out of Office', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      meeting: { icon: Calendar, label: 'In a Meeting', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      vacation: { icon: Palmtree, label: 'On Vacation', color: 'bg-teal-100 text-teal-800 border-teal-300' },
      custom: { icon: Clock, label: 'Away', color: 'bg-slate-100 text-slate-800 border-slate-300' }
    };

    return statusConfig[status.status_type] || statusConfig.custom;
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      setLoadingMessages(false);
      return;
    }

    const { data: readData } = await supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', user?.id);

    const readMessageIds = new Set(readData?.map(r => r.message_id) || []);

    const senderIds = [...new Set((data || []).map(m => m.sender_id))];
    const { data: senderData } = await supabase
      .from('sales_people')
      .select('user_id, name')
      .in('user_id', senderIds);

    const senderMap = new Map(senderData?.map(s => [s.user_id, s.name]) || []);

    const messagesWithReadStatus = (data || []).map(msg => ({
      ...msg,
      is_read: msg.sender_id === user?.id || readMessageIds.has(msg.id),
      sender_name: senderMap.get(msg.sender_id) || 'Unknown'
    }));

    setMessages(messagesWithReadStatus);
    setLoadingMessages(false);
  };

  const markMessagesAsRead = async (conversationId: string) => {
    if (!user?.id) return;

    const { data: unreadMessages } = await supabase
      .from('direct_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id);

    if (!unreadMessages?.length) return;

    const { data: existingReads } = await supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', unreadMessages.map(m => m.id));

    const existingReadIds = new Set(existingReads?.map(r => r.message_id) || []);
    const newReads = unreadMessages
      .filter(m => !existingReadIds.has(m.id))
      .map(m => ({
        message_id: m.id,
        user_id: user.id
      }));

    if (newReads.length > 0) {
      await supabase.from('message_reads').insert(newReads);
      fetchConversations();
    }
  };

  const toggleUserSelection = (selectedUser: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.user_id === selectedUser.user_id);
      if (isSelected) {
        return prev.filter(u => u.user_id !== selectedUser.user_id);
      }
      return [...prev, selectedUser];
    });
  };

  const cancelMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedUsers([]);
    setGroupName('');
  };

  const startGroupConversation = async () => {
    if (!user?.id || selectedUsers.length === 0) return;

    setCreatingGroup(true);

    if (selectedUsers.length === 1) {
      await startConversation(selectedUsers[0].user_id);
      cancelMultiSelect();
      setCreatingGroup(false);
      return;
    }

    const userIds = selectedUsers.map(u => u.user_id);

    const { data: conversationId, error } = await supabase.rpc('create_adhoc_group_conversation', {
      p_user_ids: userIds,
      p_group_name: groupName || null
    });

    if (error) {
      console.error('Error creating group conversation:', error);
      setCreatingGroup(false);
      return;
    }

    await fetchConversations();

    const participantNames = selectedUsers.map(u => u.name);
    setSelectedConversation({
      id: conversationId,
      last_message_at: new Date().toISOString(),
      other_user_id: '',
      other_user_name: groupName || participantNames.slice(0, 3).join(', ') + (participantNames.length > 3 ? ` +${participantNames.length - 3}` : ''),
      other_user_email: `${selectedUsers.length} participants`,
      unread_count: 0,
      is_group: true,
      group_name: groupName || undefined,
      participant_names: participantNames
    });

    cancelMultiSelect();
    setSidebarView('conversations');
    setCreatingGroup(false);
  };

  const startConversation = async (otherUserId: string) => {
    if (!user?.id) return;

    setShowQuickSearch(false);
    setQuickSearchTerm('');

    const existingConv = conversations.find(c => !c.is_group && c.other_user_id === otherUserId);
    if (existingConv) {
      setSelectedConversation(existingConv);
      setSidebarView('conversations');
      return;
    }

    const { data: conversationId, error } = await supabase.rpc('get_or_create_conversation', {
      other_user_id: otherUserId
    });

    if (error) {
      console.error('Error creating conversation:', error);
      return;
    }

    await fetchConversations();

    const otherUser = users.find(u => u.user_id === otherUserId);
    setSelectedConversation({
      id: conversationId,
      last_message_at: new Date().toISOString(),
      other_user_id: otherUserId,
      other_user_name: otherUser?.name || 'Unknown',
      other_user_email: otherUser?.email || '',
      unread_count: 0
    });
    setSidebarView('conversations');
  };

  const handleNotificationClick = async (notification: NewMessageNotification) => {
    setNotifications(prev => prev.filter(n => n.id !== notification.id));

    const conv = conversations.find(c => c.id === notification.conversationId);
    if (conv) {
      setSelectedConversation(conv);
    } else {
      await fetchConversations();
      const updatedConv = conversations.find(c => c.id === notification.conversationId);
      if (updatedConv) {
        setSelectedConversation(updatedConv);
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.id) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: selectedConversation.id,
      content: messageContent,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      is_read: true
    };
    setMessages(prev => [...prev, optimisticMessage]);

    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: messageContent
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageContent);
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...data, is_read: true } : m));
    }

    setSending(false);
  };

  const deleteMessage = async (messageId: string) => {
    if (!user?.id) return;

    setDeletingMessage(true);

    const { error } = await supabase
      .from('direct_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (error) {
      console.error('Error deleting message:', error);
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }

    setMessageToDelete(null);
    setDeletingMessage(false);
  };

  const deleteConversation = async (conversationId: string) => {
    if (!user?.id) return;

    setDeletingConversation(true);

    const { error: messagesError } = await supabase
      .from('direct_messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
      setDeletingConversation(false);
      setConversationToDelete(null);
      return;
    }

    const { error: readsError } = await supabase
      .from('message_reads')
      .delete()
      .in('message_id', (
        await supabase
          .from('direct_messages')
          .select('id')
          .eq('conversation_id', conversationId)
      ).data?.map(m => m.id) || []);

    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId);

    if (participantsError) {
      console.error('Error deleting participants:', participantsError);
    }

    const { error: convError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (convError) {
      console.error('Error deleting conversation:', convError);
    }

    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
      setMessages([]);
    }

    setConversations(prev => prev.filter(c => c.id !== conversationId));
    setConversationToDelete(null);
    setDeletingConversation(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.other_user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(phonebookSearchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(phonebookSearchTerm.toLowerCase()) ||
    (roleLabels[u.role] || u.role).toLowerCase().includes(phonebookSearchTerm.toLowerCase())
  );

  const quickSearchUsers = quickSearchTerm.length > 0
    ? users.filter(u =>
        u.name.toLowerCase().includes(quickSearchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(quickSearchTerm.toLowerCase())
      ).slice(0, 5)
    : [];

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    msgs.forEach(msg => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.created_at, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const groupUsersByLetter = (usersList: User[]) => {
    const groups: Record<string, User[]> = {};

    usersList.forEach(u => {
      const firstLetter = u.name.charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(u);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  if (!chatEnabled) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[calc(100vh-280px)] min-h-[500px] flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Chat Feature Disabled</h3>
          <p className="text-slate-500">
            The messaging feature is currently not available for your account. Please contact an administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[calc(100vh-280px)] min-h-[500px] relative">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          onClick={() => handleNotificationClick(notification)}
          className="fixed right-6 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 max-w-sm cursor-pointer hover:bg-slate-50 transition-all animate-slide-in"
          style={{ top: `${100 + index * 90}px` }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
              {notification.senderName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{notification.senderName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotifications(prev => prev.filter(n => n.id !== notification.id));
                  }}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <p className="text-sm text-slate-600 truncate mt-0.5">{notification.content}</p>
              <p className="text-xs text-blue-600 mt-1">Click to open conversation</p>
            </div>
          </div>
        </div>
      ))}

      <div className="flex h-full">
        <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-slate-200`}>
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {sidebarView === 'conversations' ? (
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                ) : (
                  <Book className="w-6 h-6 text-emerald-600" />
                )}
                <h2 className="text-lg font-bold text-slate-900">
                  {sidebarView === 'conversations' ? 'Messages' : 'Phonebook'}
                </h2>
                {sidebarView === 'conversations' && totalUnread > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                    {totalUnread}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateMyPresence(myPresenceStatus === 'do_not_disturb' ? 'online' : 'do_not_disturb')}
                  className={`p-2 rounded-lg transition-all ${
                    myPresenceStatus === 'do_not_disturb'
                      ? 'text-red-700 bg-red-100 hover:bg-red-200'
                      : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title={myPresenceStatus === 'do_not_disturb' ? 'Turn off Do Not Disturb' : 'Turn on Do Not Disturb'}
                >
                  <MinusCircle className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowOOOSettings(true)}
                  className={`p-2 rounded-lg transition-all ${
                    myOOOStatus?.is_enabled
                      ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                      : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                  }`}
                  title={myOOOStatus?.is_enabled ? 'Manage your status' : 'Set out of office'}
                >
                  <Clock className="w-5 h-5" />
                </button>
                {sidebarView === 'phonebook' && (
                  <button
                    onClick={() => {
                      if (multiSelectMode) {
                        cancelMultiSelect();
                      } else {
                        setMultiSelectMode(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all font-medium text-sm ${
                      multiSelectMode
                        ? 'text-white bg-blue-600 hover:bg-blue-700'
                        : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    }`}
                    title={multiSelectMode ? 'Cancel selection' : 'Select multiple people'}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">{multiSelectMode ? 'Cancel' : 'Group'}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setSidebarView(sidebarView === 'conversations' ? 'phonebook' : 'conversations');
                    setPhonebookSearchTerm('');
                    setSearchTerm('');
                    cancelMultiSelect();
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all font-medium text-sm ${
                    sidebarView === 'phonebook'
                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : 'text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm'
                  }`}
                  title={sidebarView === 'conversations' ? 'Find someone to message' : 'Back to Messages'}
                >
                  {sidebarView === 'conversations' ? (
                    <>
                      <Users className="w-4 h-4" />
                      <span>Find People</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      <span>Messages</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {(myPresenceStatus === 'do_not_disturb' || myOOOStatus?.is_enabled) && (
              <div className="mt-3 flex flex-col gap-2">
                {myPresenceStatus === 'do_not_disturb' && (
                  <div
                    className="p-2 rounded-lg border flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity bg-red-50 text-red-800 border-red-200"
                    onClick={() => updateMyPresence('online')}
                  >
                    <MinusCircle className="w-4 h-4" />
                    <span className="text-xs font-medium flex-1">Do Not Disturb is on</span>
                    <X className="w-3.5 h-3.5 opacity-60" />
                  </div>
                )}
                {myOOOStatus?.is_enabled && (
                  <div
                    className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${getOOOStatusInfo(myOOOStatus).color}`}
                    onClick={() => setShowOOOSettings(true)}
                  >
                    {(() => {
                      const StatusIcon = getOOOStatusInfo(myOOOStatus).icon;
                      return <StatusIcon className="w-4 h-4" />;
                    })()}
                    <span className="text-xs font-medium flex-1">You are: {getOOOStatusInfo(myOOOStatus).label}</span>
                    <Settings className="w-3.5 h-3.5 opacity-60" />
                  </div>
                )}
              </div>
            )}

            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={sidebarView === 'conversations' ? 'Search conversations...' : 'Search employees...'}
                value={sidebarView === 'conversations' ? searchTerm : phonebookSearchTerm}
                onChange={(e) => sidebarView === 'conversations' ? setSearchTerm(e.target.value) : setPhonebookSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sidebarView === 'conversations' ? (
              loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-6 text-center">
                  <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No conversations yet</p>
                  <button
                    onClick={() => setSidebarView('phonebook')}
                    className="mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1 mx-auto"
                  >
                    <Book className="w-4 h-4" />
                    Open Phonebook
                  </button>
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 group relative ${
                      selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    {conversationToDelete === conv.id ? (
                      <div className="w-full bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                        <p className="text-sm text-slate-700 mb-3">Delete this conversation and all messages?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConversationToDelete(null)}
                            className="flex-1 px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => deleteConversation(conv.id)}
                            disabled={deletingConversation}
                            className="flex-1 px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            {deletingConversation ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setSelectedConversation(conv)}
                          className="flex items-start gap-3 flex-1 min-w-0 text-left"
                        >
                          <div className="relative flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                              conv.is_group
                                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                                : 'bg-gradient-to-br from-blue-500 to-blue-600'
                            }`}>
                              {conv.is_group ? (
                                <Users className="w-5 h-5" />
                              ) : (
                                conv.other_user_name.charAt(0).toUpperCase()
                              )}
                            </div>
                            {!conv.is_group && (
                              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getPresenceIndicator(conv.other_user_id).color}`} title={getPresenceIndicator(conv.other_user_id).label} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`font-medium text-slate-900 truncate ${conv.unread_count > 0 ? 'font-semibold' : ''}`}>
                                  {conv.other_user_name}
                                </span>
                                {!conv.is_group && outOfOfficeStatuses[conv.other_user_id] && (() => {
                                  const statusInfo = getOOOStatusInfo(outOfOfficeStatuses[conv.other_user_id]);
                                  const StatusIcon = statusInfo.icon;
                                  return (
                                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex items-center gap-0.5 flex-shrink-0 ${statusInfo.color}`}>
                                      <StatusIcon className="w-2.5 h-2.5" />
                                      Away
                                    </span>
                                  );
                                })()}
                              </div>
                              <span className="text-xs text-slate-500 flex-shrink-0">
                                {formatTime(conv.last_message_at)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className={`text-sm truncate ${conv.unread_count > 0 ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                                {conv.last_message || 'No messages yet'}
                              </p>
                              {conv.unread_count > 0 && (
                                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-xs font-bold rounded-full flex-shrink-0">
                                  {conv.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConversationToDelete(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )
            ) : (
              <div>
                {filteredUsers.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    No employees found
                  </div>
                ) : (
                  groupUsersByLetter(filteredUsers).map(([letter, letterUsers]) => (
                    <div key={letter}>
                      <div className="sticky top-0 bg-slate-100 px-4 py-2 border-b border-slate-200">
                        <span className="text-sm font-bold text-slate-700">{letter}</span>
                      </div>
                      {letterUsers.map(u => {
                        const isSelected = selectedUsers.some(su => su.user_id === u.user_id);
                        return (
                          <div
                            key={u.id}
                            onClick={multiSelectMode ? () => toggleUserSelection(u) : undefined}
                            className={`p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 ${
                              multiSelectMode ? 'cursor-pointer' : ''
                            } ${isSelected ? 'bg-blue-50' : ''}`}
                          >
                            {multiSelectMode && (
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-3 transition-all ${
                                isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                              }`}>
                                {isSelected && <Check className="w-4 h-4 text-white" />}
                              </div>
                            )}
                            <div className="relative flex-shrink-0">
                              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarColors[u.role] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-white font-semibold text-lg`}>
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${getPresenceIndicator(u.user_id).color}`} title={getPresenceIndicator(u.user_id).label} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900">{u.name}</span>
                                {outOfOfficeStatuses[u.user_id] && (() => {
                                  const statusInfo = getOOOStatusInfo(outOfOfficeStatuses[u.user_id]);
                                  const StatusIcon = statusInfo.icon;
                                  return (
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${statusInfo.color}`}>
                                      <StatusIcon className="w-3 h-3" />
                                      {statusInfo.label}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="mt-1 space-y-0.5">
                                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                                  <Mail className="w-3.5 h-3.5" />
                                  {u.email}
                                </p>
                                {u.cell_phone && (
                                  <p className="text-sm text-slate-500 flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" />
                                    {u.cell_phone}
                                  </p>
                                )}
                                {outOfOfficeStatuses[u.user_id]?.custom_message && (
                                  <p className="text-sm text-amber-700 flex items-center gap-1.5 mt-1">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {outOfOfficeStatuses[u.user_id].custom_message}
                                  </p>
                                )}
                              </div>
                              {!multiSelectMode && (
                                <button
                                  onClick={() => startConversation(u.user_id)}
                                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  Send Message
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {multiSelectMode && selectedUsers.length > 0 && (
            <div className="p-4 bg-white border-t border-slate-200 shadow-lg">
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedUsers.map(u => (
                  <div
                    key={u.user_id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    <span className="font-medium">{u.name.split(' ')[0]}</span>
                    <button
                      onClick={() => toggleUserSelection(u)}
                      className="p-0.5 hover:bg-blue-200 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {selectedUsers.length > 1 && (
                <input
                  type="text"
                  placeholder="Group name (optional)"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
              <button
                onClick={startGroupConversation}
                disabled={creatingGroup}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {creatingGroup ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {selectedUsers.length === 1 ? 'Start Conversation' : `Start Group Chat (${selectedUsers.length})`}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-slate-50`}>
          {selectedConversation ? (
            <>
              <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                    selectedConversation.is_group
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                      : 'bg-gradient-to-br from-blue-500 to-blue-600'
                  }`}>
                    {selectedConversation.is_group ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      selectedConversation.other_user_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  {!selectedConversation.is_group && (
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getPresenceIndicator(selectedConversation.other_user_id).color}`} title={getPresenceIndicator(selectedConversation.other_user_id).label} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{selectedConversation.other_user_name}</h3>
                  <p className="text-sm text-slate-500 truncate">{selectedConversation.other_user_email}</p>
                </div>
              </div>

              {!selectedConversation.is_group && outOfOfficeStatuses[selectedConversation.other_user_id] && (() => {
                const status = outOfOfficeStatuses[selectedConversation.other_user_id];
                const statusInfo = getOOOStatusInfo(status);
                const StatusIcon = statusInfo.icon;
                return (
                  <div className={`mx-4 mt-2 p-3 rounded-lg border ${statusInfo.color} flex items-start gap-3`}>
                    <StatusIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {selectedConversation.other_user_name.split(' ')[0]} is {statusInfo.label.toLowerCase()}
                      </p>
                      {status.custom_message && (
                        <p className="text-sm mt-1 opacity-90">{status.custom_message}</p>
                      )}
                      {status.end_time && (
                        <p className="text-xs mt-1 opacity-75">
                          Expected back: {new Date(status.end_time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  groupMessagesByDate(messages).map((group, groupIndex) => (
                    <div key={groupIndex}>
                      <div className="flex items-center justify-center my-4">
                        <span className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                          {formatMessageDate(group.date)}
                        </span>
                      </div>
                      {group.messages.map((msg) => {
                        const isOwn = msg.sender_id === user?.id;
                        const showSenderName = selectedConversation?.is_group && !isOwn;
                        const showDeleteConfirm = messageToDelete === msg.id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2 group`}
                          >
                            {isOwn && !showDeleteConfirm && (
                              <button
                                onClick={() => setMessageToDelete(msg.id)}
                                className="opacity-0 group-hover:opacity-100 self-center mr-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete message"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {showDeleteConfirm ? (
                              <div className="bg-white rounded-2xl px-4 py-3 shadow-lg border border-slate-200 max-w-[75%]">
                                <p className="text-sm text-slate-700 mb-3">Delete this message?</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setMessageToDelete(null)}
                                    className="flex-1 px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => deleteMessage(msg.id)}
                                    disabled={deletingMessage}
                                    className="flex-1 px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-lg transition-colors flex items-center justify-center gap-1"
                                  >
                                    {deletingMessage ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                                  isOwn
                                    ? 'bg-blue-600 text-white rounded-br-md'
                                    : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-200'
                                }`}
                              >
                                {showSenderName && (
                                  <p className="text-xs font-semibold text-emerald-600 mb-1">
                                    {msg.sender_name}
                                  </p>
                                )}
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? 'text-blue-200' : 'text-slate-400'}`}>
                                  <span className="text-xs">{formatMessageTime(msg.created_at)}</span>
                                  {isOwn && (
                                    msg.is_read ? (
                                      <CheckCheck className="w-3.5 h-3.5" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-slate-200">
                <div className="flex items-end gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-32"
                    style={{ minHeight: '44px' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="text-center max-w-md">
                <MessageCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Select a conversation</h3>
                <p className="text-slate-500 mb-6">Choose from recent messages or find someone to message</p>

                <div className="relative mb-4">
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      ref={quickSearchRef}
                      type="text"
                      placeholder="Quick search: Type a name to message..."
                      value={quickSearchTerm}
                      onChange={(e) => {
                        setQuickSearchTerm(e.target.value);
                        setShowQuickSearch(e.target.value.length > 0);
                      }}
                      onFocus={() => setShowQuickSearch(quickSearchTerm.length > 0)}
                      className="w-full pl-12 pr-4 py-3 text-base border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    {quickSearchTerm && (
                      <button
                        onClick={() => {
                          setQuickSearchTerm('');
                          setShowQuickSearch(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    )}
                  </div>

                  {showQuickSearch && quickSearchUsers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-10">
                      {quickSearchUsers.map(u => (
                        <button
                          key={u.id}
                          onClick={() => startConversation(u.user_id)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 text-left"
                        >
                          <div className="relative flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[u.role] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-white font-semibold`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getPresenceIndicator(u.user_id).color}`} title={getPresenceIndicator(u.user_id).label} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-slate-900">{u.name}</span>
                            <p className="text-sm text-slate-500 truncate">{u.email}</p>
                          </div>
                          <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  {showQuickSearch && quickSearchTerm.length > 0 && quickSearchUsers.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 text-center text-slate-500 z-10">
                      No employees found matching "{quickSearchTerm}"
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 justify-center text-sm text-slate-500 mb-4">
                  <span className="border-b border-slate-200 flex-1" />
                  <span>or</span>
                  <span className="border-b border-slate-200 flex-1" />
                </div>

                <button
                  onClick={() => setSidebarView('phonebook')}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium flex items-center gap-2 mx-auto"
                >
                  <Book className="w-5 h-5" />
                  Browse Full Phonebook
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showOOOSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Out of Office Status
                </h3>
                <button
                  onClick={() => setShowOOOSettings(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Let others know when you're unavailable
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Enable Status</p>
                  <p className="text-sm text-slate-500">Show others you're away</p>
                </div>
                <button
                  onClick={() => setOOOFormData(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    oooFormData.is_enabled ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    oooFormData.is_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {oooFormData.is_enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Status Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'lunch', label: 'At Lunch', icon: Coffee },
                        { value: 'out_of_office', label: 'Out of Office', icon: Briefcase },
                        { value: 'meeting', label: 'In a Meeting', icon: Calendar },
                        { value: 'vacation', label: 'On Vacation', icon: Palmtree },
                        { value: 'custom', label: 'Custom', icon: Clock }
                      ].map(option => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setOOOFormData(prev => ({ ...prev, status_type: option.value as OutOfOfficeStatus['status_type'] }))}
                            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                              oooFormData.status_type === option.value
                                ? 'border-amber-500 bg-amber-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${oooFormData.status_type === option.value ? 'text-amber-600' : 'text-slate-500'}`} />
                            <span className="text-sm font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Custom Message <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={oooFormData.custom_message}
                      onChange={(e) => setOOOFormData(prev => ({ ...prev, custom_message: e.target.value }))}
                      placeholder="e.g., Back in 30 minutes, or Reach me at..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Return Time <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={oooFormData.end_time}
                      onChange={(e) => setOOOFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">Leave empty for indefinite</p>
                  </div>

                  {oooFormData.end_time && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900 text-sm">Auto-disable at return time</p>
                        <p className="text-xs text-slate-500">Automatically turn off status when time is reached</p>
                      </div>
                      <button
                        onClick={() => setOOOFormData(prev => ({ ...prev, auto_disable: !prev.auto_disable }))}
                        className={`relative w-10 h-6 rounded-full transition-colors ${
                          oooFormData.auto_disable ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          oooFormData.auto_disable ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  )}
                </>
              )}

              {myOOOStatus?.is_enabled && !oooFormData.is_enabled && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      Turning this off will clear your out of office status and others will no longer see you as away.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowOOOSettings(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveOOOStatus}
                disabled={savingOOO}
                className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {savingOOO ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Save Status'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
