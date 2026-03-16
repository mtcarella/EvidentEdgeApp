import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, ChevronUp, Maximize2, Users, ArrowLeft, Search, Phone, Mail, Clock, ChevronRight, Coffee, Briefcase, Calendar, Palmtree } from 'lucide-react';
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
  source_group_id?: string;
}

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

interface CenteredPopupMessage {
  id: string;
  content: string;
  senderName: string;
  senderEmail: string;
  senderId: string;
  conversationId: string;
  createdAt: string;
  senderRole?: string;
  isLoginMessage: boolean;
  replyText: string;
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

const roleColors: Record<string, string> = {
  super_admin: 'from-purple-500 to-purple-600',
  admin: 'from-amber-500 to-amber-600',
  salesperson: 'from-blue-500 to-blue-600',
  closer: 'from-emerald-500 to-emerald-600',
  processor: 'from-teal-500 to-teal-600',
  sales_processor: 'from-cyan-500 to-cyan-600'
};

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  salesperson: 'Sales',
  closer: 'Closer',
  processor: 'Processor',
  sales_processor: 'Sales Processor'
};

const roleBadgeColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-amber-100 text-amber-800',
  salesperson: 'bg-blue-100 text-blue-800',
  closer: 'bg-emerald-100 text-emerald-800',
  processor: 'bg-teal-100 text-teal-800',
  sales_processor: 'bg-cyan-100 text-cyan-800'
};

export function FloatingChat() {
  const { user, salesPerson } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(true);
  const [view, setView] = useState<'list' | 'chat' | 'users'>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGroupsTab, setShowGroupsTab] = useState(false);
  const [centeredPopupQueue, setCenteredPopupQueue] = useState<CenteredPopupMessage[]>([]);
  const [showCenteredPopup, setShowCenteredPopup] = useState(false);
  const [sendingCenteredReply, setSendingCenteredReply] = useState(false);
  const [popupMinimized, setPopupMinimized] = useState(false);
  const [outOfOfficeStatuses, setOutOfOfficeStatuses] = useState<Record<string, OutOfOfficeStatus>>({});
  const hasCheckedFirstUnread = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedConversationRef = useRef<Conversation | null>(null);
  const isMinimizedRef = useRef(isMinimized);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchConversations();
      fetchUsers();
      fetchGroups();
      fetchOutOfOfficeStatuses();
      checkFirstUnreadMessage();
    }
  }, [user?.id]);

  const checkFirstUnreadMessage = async () => {
    if (!user?.id || hasCheckedFirstUnread.current) return;
    hasCheckedFirstUnread.current = true;

    try {
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!participations?.length) return;

      const conversationIds = participations.map(p => p.conversation_id);

      const { data: readMessageIds } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id);

      const readSet = new Set(readMessageIds?.map(r => r.message_id) || []);

      const { data: unreadMessages } = await supabase
        .from('direct_messages')
        .select('id, content, sender_id, conversation_id, created_at')
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);

      const allUnread = unreadMessages?.filter(m => !readSet.has(m.id)) || [];
      if (allUnread.length === 0) return;

      const senderIds = [...new Set(allUnread.map(m => m.sender_id))];
      const { data: sendersData } = await supabase
        .from('sales_people')
        .select('user_id, name, email, role')
        .in('user_id', senderIds);

      const senderMap = new Map(sendersData?.map(s => [s.user_id, s]) || []);

      const loginMessages: CenteredPopupMessage[] = allUnread
        .map(msg => {
          const sender = senderMap.get(msg.sender_id);
          if (!sender) return null;
          return {
            id: msg.id,
            content: msg.content,
            senderName: sender.name,
            senderEmail: sender.email,
            senderId: msg.sender_id,
            conversationId: msg.conversation_id,
            createdAt: msg.created_at,
            senderRole: sender.role,
            isLoginMessage: true,
            replyText: ''
          };
        })
        .filter((m): m is CenteredPopupMessage => m !== null);

      if (loginMessages.length > 0) {
        setCenteredPopupQueue(loginMessages);
        setShowCenteredPopup(true);
        setPopupMinimized(false);
      }
    } catch (error) {
      console.error('Error checking first unread:', error);
    }
  };

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('floating_chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages'
        },
        async (payload) => {
          const newMsg = payload.new as Message & { conversation_id: string };
          const currentConversation = selectedConversationRef.current;
          const currentIsMinimized = isMinimizedRef.current;

          if (currentConversation && newMsg.conversation_id === currentConversation.id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id || m.id.startsWith('temp-'))) return prev;
              return [...prev, newMsg];
            });
            if (newMsg.sender_id !== user.id) {
              markMessagesAsRead(currentConversation.id);
            }
          }

          if (newMsg.sender_id !== user.id) {
            const isViewingThisConversation = !currentIsMinimized && currentConversation && currentConversation.id === newMsg.conversation_id;

            if (!isViewingThisConversation) {
              const sender = users.find(u => u.user_id === newMsg.sender_id);
              let senderName = sender?.name || 'Unknown';
              let senderEmail = sender?.email || '';
              let senderRole = sender?.role;

              if (!sender) {
                const { data: senderData } = await supabase
                  .from('sales_people')
                  .select('name, email, role')
                  .eq('user_id', newMsg.sender_id)
                  .maybeSingle();
                if (senderData) {
                  senderName = senderData.name;
                  senderEmail = senderData.email;
                  senderRole = senderData.role;
                }
              }

              const newPopupMessage: CenteredPopupMessage = {
                id: newMsg.id,
                content: newMsg.content,
                senderName,
                senderEmail,
                senderId: newMsg.sender_id,
                conversationId: newMsg.conversation_id,
                createdAt: newMsg.created_at,
                senderRole,
                isLoginMessage: false,
                replyText: ''
              };

              setCenteredPopupQueue(prev => {
                const existingIndex = prev.findIndex(m => m.conversationId === newMsg.conversation_id && !m.isLoginMessage);
                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = { ...newPopupMessage, replyText: prev[existingIndex].replyText };
                  return updated;
                }
                const loginMessages = prev.filter(m => m.isLoginMessage);
                const realtimeMessages = prev.filter(m => !m.isLoginMessage);
                return [...loginMessages, ...realtimeMessages, newPopupMessage];
              });

              setShowCenteredPopup(true);
            }
          }

          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedConversation?.id, isMinimized, users]);

  useEffect(() => {
    if (view === 'chat' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [view, selectedConversation]);

  const fetchConversations = async () => {
    if (!user?.id) return;

    setLoading(true);

    const { data: participations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!participations?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = participations.map(p => p.conversation_id);

    const { data: convData } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false });

    if (!convData) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationsWithDetails = await Promise.all(
      convData.map(async (conv) => {
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conv.id);

        const isGroup = conv.is_group === true;
        let otherUserName = 'Unknown';
        let otherUserEmail = '';
        let otherUserId = '';

        if (isGroup) {
          otherUserName = conv.group_name || 'Group Chat';
          const participantCount = participants?.length || 0;
          otherUserEmail = `${participantCount} members`;
        } else {
          otherUserId = participants?.find(p => p.user_id !== user.id)?.user_id || '';

          if (otherUserId) {
            const { data: userData } = await supabase
              .from('sales_people')
              .select('name, email')
              .eq('user_id', otherUserId)
              .maybeSingle();

            if (userData) {
              otherUserName = userData.name;
              otherUserEmail = userData.email;
            }
          }
        }

        const { data: lastMsg } = await supabase
          .from('direct_messages')
          .select('content')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: allMessages } = await supabase
          .from('direct_messages')
          .select('id')
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id);

        const { data: readMessages } = await supabase
          .from('message_reads')
          .select('message_id')
          .eq('user_id', user.id);

        const readMessageIds = new Set(readMessages?.map(r => r.message_id) || []);
        const unreadCount = allMessages?.filter(m => !readMessageIds.has(m.id)).length || 0;

        return {
          id: conv.id,
          last_message_at: conv.last_message_at,
          other_user_id: otherUserId,
          other_user_name: otherUserName,
          other_user_email: otherUserEmail,
          last_message: lastMsg?.content,
          unread_count: unreadCount,
          is_group: isGroup,
          group_name: conv.group_name,
          source_group_id: conv.source_group_id
        };
      })
    );

    setConversations(conversationsWithDetails);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('sales_people')
      .select('id, user_id, name, email, role, cell_phone')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setUsers(data.filter(u => u.user_id !== user?.id));
    }
  };

  const fetchGroups = async () => {
    const { data: groupsData } = await supabase
      .from('user_groups')
      .select('*')
      .order('name');

    if (groupsData) {
      const groupsWithCounts = await Promise.all(
        groupsData.map(async (group) => {
          const { count } = await supabase
            .from('user_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          return { ...group, member_count: count || 0 };
        })
      );
      setGroups(groupsWithCounts);
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
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data && selectedConversation?.is_group) {
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: senders } = await supabase
        .from('sales_people')
        .select('user_id, name')
        .in('user_id', senderIds);

      const senderMap = new Map(senders?.map(s => [s.user_id, s.name]) || []);
      const messagesWithNames = data.map(m => ({
        ...m,
        sender_name: senderMap.get(m.sender_id) || 'Unknown'
      }));
      setMessages(messagesWithNames);
    } else {
      setMessages(data || []);
    }
    markMessagesAsRead(conversationId);
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

  const currentPopupMessage = centeredPopupQueue[0] || null;

  const updateCurrentReplyText = (text: string) => {
    if (centeredPopupQueue.length === 0) return;
    setCenteredPopupQueue(prev => {
      const updated = [...prev];
      if (updated[0]) {
        updated[0] = { ...updated[0], replyText: text };
      }
      return updated;
    });
  };

  const dismissCurrentPopup = async () => {
    if (!currentPopupMessage || !user?.id) return;

    await supabase.from('message_reads').upsert({
      message_id: currentPopupMessage.id,
      user_id: user.id
    }, { onConflict: 'message_id,user_id' });

    setCenteredPopupQueue(prev => prev.slice(1));
    if (centeredPopupQueue.length <= 1) {
      setShowCenteredPopup(false);
      setPopupMinimized(true);
    }
    fetchConversations();
  };

  const minimizePopups = async () => {
    setPopupMinimized(true);
    setShowCenteredPopup(false);
  };

  const restorePopups = () => {
    if (centeredPopupQueue.length > 0) {
      setPopupMinimized(false);
      setShowCenteredPopup(true);
    }
  };

  const sendPopupReply = async () => {
    if (!currentPopupMessage || !user?.id || !currentPopupMessage.replyText.trim()) return;

    setSendingCenteredReply(true);
    const replyContent = currentPopupMessage.replyText.trim();

    const { error } = await supabase
      .from('direct_messages')
      .insert({
        conversation_id: currentPopupMessage.conversationId,
        sender_id: user.id,
        content: replyContent
      });

    if (!error) {
      await supabase.from('message_reads').upsert({
        message_id: currentPopupMessage.id,
        user_id: user.id
      }, { onConflict: 'message_id,user_id' });

      setCenteredPopupQueue(prev => prev.slice(1));
      if (centeredPopupQueue.length <= 1) {
        setShowCenteredPopup(false);
        setPopupMinimized(true);
      }
      fetchConversations();
    }

    setSendingCenteredReply(false);
  };

  const openConversationFromPopup = async () => {
    if (!currentPopupMessage) return;

    await supabase.from('message_reads').upsert({
      message_id: currentPopupMessage.id,
      user_id: user?.id
    }, { onConflict: 'message_id,user_id' });

    setCenteredPopupQueue(prev => prev.slice(1));
    if (centeredPopupQueue.length <= 1) {
      setShowCenteredPopup(false);
    }
    setPopupMinimized(true);
    setIsMinimized(false);

    const existingConv = conversations.find(c => c.id === currentPopupMessage.conversationId);
    if (existingConv) {
      setSelectedConversation(existingConv);
      setView('chat');
    } else {
      setSelectedConversation({
        id: currentPopupMessage.conversationId,
        last_message_at: currentPopupMessage.createdAt,
        other_user_id: currentPopupMessage.senderId,
        other_user_name: currentPopupMessage.senderName,
        other_user_email: currentPopupMessage.senderEmail,
        unread_count: 1
      });
      setView('chat');
    }

    fetchConversations();
  };

  const formatPopupTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalUnreadInQueue = centeredPopupQueue.length;
  const loginMessagesCount = centeredPopupQueue.filter(m => m.isLoginMessage).length;

  const startConversation = async (otherUserId: string) => {
    if (!user?.id) return;

    const existingConv = conversations.find(c => !c.is_group && c.other_user_id === otherUserId);
    if (existingConv) {
      setSelectedConversation(existingConv);
      setView('chat');
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
    setView('chat');
  };

  const startGroupConversation = async (groupId: string, groupName: string) => {
    if (!user?.id) return;

    const existingConv = conversations.find(c => c.is_group && c.source_group_id === groupId);
    if (existingConv) {
      setSelectedConversation(existingConv);
      setView('chat');
      return;
    }

    const { data: conversationId, error } = await supabase.rpc('get_or_create_group_conversation', {
      p_group_id: groupId,
      p_group_name: groupName
    });

    if (error) {
      console.error('Error creating group conversation:', error);
      return;
    }

    await fetchConversations();

    const group = groups.find(g => g.id === groupId);
    setSelectedConversation({
      id: conversationId,
      last_message_at: new Date().toISOString(),
      other_user_id: '',
      other_user_name: groupName,
      other_user_email: `${group?.member_count || 0} members`,
      unread_count: 0,
      is_group: true,
      group_name: groupName,
      source_group_id: groupId
    });
    setView('chat');
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.id) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      sender_name: salesPerson?.name
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
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    }

    setSending(false);
    inputRef.current?.focus();
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
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!user?.id || !salesPerson) return null;

  return (
    <>
      {showCenteredPopup && !popupMinimized && currentPopupMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${roleColors[currentPopupMessage.senderRole || 'salesperson'] || roleColors.salesperson} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                  {currentPopupMessage.senderName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {currentPopupMessage.isLoginMessage ? 'Unread Message' : 'New Message'}
                    </h2>
                    {totalUnreadInQueue > 1 && (
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white font-medium">
                        {totalUnreadInQueue} messages
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-blue-100 text-sm">from {currentPopupMessage.senderName}</span>
                    {currentPopupMessage.senderRole && (
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
                        {roleLabels[currentPopupMessage.senderRole] || currentPopupMessage.senderRole}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={minimizePopups}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  title="Minimize"
                >
                  <ChevronUp className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={dismissCurrentPopup}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  title="Dismiss"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {totalUnreadInQueue > 1 && (
              <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                {centeredPopupQueue.slice(0, 5).map((msg, idx) => (
                  <div
                    key={msg.id}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx === 0 ? 'bg-blue-600 w-6' : 'bg-slate-300'
                    }`}
                  />
                ))}
                {totalUnreadInQueue > 5 && (
                  <span className="text-xs text-slate-500">+{totalUnreadInQueue - 5} more</span>
                )}
                <span className="ml-auto text-sm text-slate-500">
                  1 of {totalUnreadInQueue}
                </span>
              </div>
            )}

            <div className="p-6">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                <Clock className="w-4 h-4" />
                {formatPopupTime(currentPopupMessage.createdAt)}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
                <p className="text-slate-800 text-base leading-relaxed whitespace-pre-wrap break-words">
                  {currentPopupMessage.content}
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    value={currentPopupMessage.replyText}
                    onChange={(e) => updateCurrentReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && currentPopupMessage.replyText.trim()) {
                        e.preventDefault();
                        sendPopupReply();
                      }
                    }}
                    placeholder="Type a reply..."
                    rows={2}
                    className="w-full px-4 py-3 text-base border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={minimizePopups}
                    className="px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                  >
                    Minimize
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={openConversationFromPopup}
                      className="flex items-center gap-2 px-4 py-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors font-medium"
                    >
                      Open Chat
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={sendPopupReply}
                      disabled={sendingCenteredReply || !currentPopupMessage.replyText.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium shadow-lg shadow-blue-500/25"
                    >
                      {sendingCenteredReply ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          {totalUnreadInQueue > 1 ? 'Reply & Next' : 'Reply'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {popupMinimized && centeredPopupQueue.length > 0 && (
        <button
          onClick={restorePopups}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-blue-600 text-white px-5 py-3 rounded-full shadow-2xl hover:bg-blue-700 transition-all flex items-center gap-3 animate-in slide-in-from-top duration-300"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            <span className="font-semibold">
              {centeredPopupQueue.length} unread message{centeredPopupQueue.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
            <ChevronUp className="w-4 h-4 rotate-180" />
          </div>
        </button>
      )}

      <div className="fixed bottom-0 right-6 z-50">
        {isMinimized ? (
          <div
            onClick={() => setIsMinimized(false)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl shadow-2xl w-80 cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            <div className="p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-lg">Messages</span>
                  {totalUnread > 0 && (
                    <span className="ml-2 px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                      {totalUnread} new
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(false);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-t-2xl shadow-2xl border border-slate-200 border-b-0 w-[420px] h-[600px] flex flex-col overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                {view !== 'list' && (
                  <button
                    onClick={() => {
                      if (view === 'chat') {
                        setSelectedConversation(null);
                      }
                      setView('list');
                      setSearchTerm('');
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                {view === 'chat' && selectedConversation ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">
                      {selectedConversation.is_group ? (
                        <Users className="w-5 h-5" />
                      ) : (
                        selectedConversation.other_user_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-lg">{selectedConversation.other_user_name}</span>
                      <p className="text-blue-100 text-xs">{selectedConversation.other_user_email}</p>
                    </div>
                  </div>
                ) : view === 'users' ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-lg">Find People</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-lg">Messages</span>
                      {totalUnread > 0 && (
                        <span className="ml-2 px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          {totalUnread}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {view === 'list' && (
                  <button
                    onClick={() => setView('users')}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Find people"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsMinimized(true);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {view === 'list' && (
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageCircle className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium mb-2">No conversations yet</p>
                    <p className="text-slate-400 text-sm mb-4">Start chatting with a colleague</p>
                    <button
                      onClick={() => setView('users')}
                      className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      Start a conversation
                    </button>
                  </div>
                ) : (
                  conversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setSelectedConversation(conv);
                        setView('chat');
                      }}
                      className={`w-full p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors border-b border-slate-100 text-left ${
                        conv.unread_count > 0 ? 'bg-blue-50/70' : ''
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                        conv.is_group ? 'from-emerald-500 to-teal-600' : 'from-blue-500 to-blue-600'
                      } flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                        {conv.is_group ? (
                          <Users className="w-6 h-6" />
                        ) : (
                          conv.other_user_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-base truncate ${conv.unread_count > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                              {conv.other_user_name}
                            </span>
                            {!conv.is_group && outOfOfficeStatuses[conv.other_user_id] && (() => {
                              const statusInfo = getOOOStatusInfo(outOfOfficeStatuses[conv.other_user_id]);
                              const StatusIcon = statusInfo.icon;
                              return (
                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex items-center gap-0.5 flex-shrink-0 ${statusInfo.color}`}>
                                  <StatusIcon className="w-2.5 h-2.5" />
                                </span>
                              );
                            })()}
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className={`text-sm truncate ${conv.unread_count > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                            {conv.last_message || 'No messages yet'}
                          </p>
                          {conv.unread_count > 0 && (
                            <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-blue-600 text-white text-xs font-bold rounded-full flex-shrink-0">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {view === 'users' && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-slate-200 bg-slate-50">
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setShowGroupsTab(false)}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                        !showGroupsTab
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      People
                    </button>
                    <button
                      onClick={() => setShowGroupsTab(true)}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                        showGroupsTab
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Groups
                      {groups.length > 0 && (
                        <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                          showGroupsTab ? 'bg-white/20' : 'bg-slate-200'
                        }`}>
                          {groups.length}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder={showGroupsTab ? "Search groups..." : "Search people..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 text-base border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {!showGroupsTab ? (
                    filteredUsers.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        No people found
                      </div>
                    ) : (
                      filteredUsers.map(u => (
                        <button
                          key={u.id}
                          onClick={() => startConversation(u.user_id)}
                          className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors border-b border-slate-100 text-left"
                        >
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${roleColors[u.role] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">{u.name}</span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${roleBadgeColors[u.role] || 'bg-slate-100 text-slate-800'}`}>
                                {roleLabels[u.role] || u.role}
                              </span>
                              {outOfOfficeStatuses[u.user_id] && (() => {
                                const statusInfo = getOOOStatusInfo(outOfOfficeStatuses[u.user_id]);
                                const StatusIcon = statusInfo.icon;
                                return (
                                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded flex items-center gap-1 ${statusInfo.color}`}>
                                    <StatusIcon className="w-3 h-3" />
                                    Away
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-sm text-slate-500 truncate flex items-center gap-1.5 mt-1">
                              <Mail className="w-3.5 h-3.5" />
                              {u.email}
                            </p>
                            {u.cell_phone && (
                              <p className="text-sm text-slate-500 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5" />
                                {u.cell_phone}
                              </p>
                            )}
                          </div>
                        </button>
                      ))
                    )
                  ) : (
                    filteredGroups.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium mb-1">No groups found</p>
                        <p className="text-slate-400 text-sm">Groups are created in Employee Communications</p>
                      </div>
                    ) : (
                      filteredGroups.map(g => (
                        <button
                          key={g.id}
                          onClick={() => startGroupConversation(g.id, g.name)}
                          className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors border-b border-slate-100 text-left"
                        >
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white flex-shrink-0">
                            <Users className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{g.name}</span>
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-800">
                                {g.member_count} member{g.member_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {g.description && (
                              <p className="text-sm text-slate-500 truncate mt-1">
                                {g.description}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </button>
                      ))
                    )
                  )}
                </div>
              </div>
            )}

            {view === 'chat' && selectedConversation && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <MessageCircle className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-500">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      const showSenderName = selectedConversation.is_group && !isOwn;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                              isOwn
                                ? 'bg-blue-600 text-white rounded-br-md'
                                : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-200'
                            }`}
                          >
                            {showSenderName && (
                              <p className="text-xs font-semibold text-blue-600 mb-1">
                                {msg.sender_name || 'Unknown'}
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                            <p className={`text-xs mt-1.5 ${isOwn ? 'text-blue-200' : 'text-slate-400'}`}>
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-white border-t border-slate-200">
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Type a message..."
                      rows={1}
                      className="flex-1 px-4 py-3 text-base border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none max-h-28 transition-all"
                      style={{ minHeight: '48px' }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      {sending ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes scale-in {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out forwards;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out forwards;
        }
      `}</style>
    </>
  );
}
