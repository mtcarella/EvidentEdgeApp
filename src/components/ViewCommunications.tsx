import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Search, Clock, Users, Send, X, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from './Toast';
import ContactExecutive from './ContactExecutive';

interface User {
  id: string;
  user_id: string;
  name: string;
  email: string;
  cell_phone?: string;
  role: string;
}

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
}

interface CommunicationLog {
  id: string;
  sent_by: string;
  communication_type: 'email' | 'sms';
  recipient_type: 'individual' | 'group';
  recipient_ids: string[];
  group_id: string | null;
  subject: string | null;
  message: string;
  sent_at: string;
  sender_name?: string;
  group_name?: string;
  deleted_by_user?: string[];
  deleted_at?: string;
}

type Tab = 'send' | 'inbox';

export function ViewCommunications() {
  const { user, salesPerson } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'email' | 'sms'>('all');

  // Send message states
  const [users, setUsers] = useState<User[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [communicationType, setCommunicationType] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showContactExecutive, setShowContactExecutive] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [showDeletedMessages, setShowDeletedMessages] = useState(false);

  useEffect(() => {
    fetchCommunications();
    fetchUsers();
    fetchUserGroups();
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'inbox') {
      fetchCommunications();
    }
  }, [activeTab]);

  const markCommunicationsAsRead = async (commIds: string[]) => {
    if (!user?.id || commIds.length === 0) return;

    const inserts = commIds.map(commId => ({
      communication_id: commId,
      user_id: user.id
    }));

    await supabase
      .from('communication_reads')
      .upsert(inserts, { onConflict: 'communication_id,user_id', ignoreDuplicates: true });
  };

  const fetchCommunications = async () => {
    if (!user?.id) return;

    setLoading(true);

    let query = supabase
      .from('communication_logs')
      .select('*');

    const isAdminUser = salesPerson?.role === 'admin' || salesPerson?.role === 'super_admin';

    if (!isAdminUser) {
      query = query.or(`recipient_ids.cs.{${user.id}},sent_by.eq.${user.id}`);
    }

    const { data: logs, error } = await query.order('sent_at', { ascending: false });

    if (error) {
      console.error('Error fetching communications:', error);
      setLoading(false);
      return;
    }

    const logsWithDetails = await Promise.all(
      (logs || []).map(async (log) => {
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

        return {
          ...log,
          sender_name: senderData?.name || 'Unknown',
          group_name: groupName
        };
      })
    );

    setCommunications(logsWithDetails);
    setLoading(false);

    const visibleLogs = logsWithDetails.filter(log => {
      const deletedBy = log.deleted_by_user || [];
      return !deletedBy.includes(user.id);
    });

    if (visibleLogs.length > 0) {
      const commIds = visibleLogs.map(log => log.id);
      markCommunicationsAsRead(commIds);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.id) return;

    setDeletingMessageId(messageId);

    const message = communications.find(c => c.id === messageId);
    const currentDeletedBy = message?.deleted_by_user || [];

    const { error } = await supabase
      .from('communication_logs')
      .update({
        deleted_by_user: [...currentDeletedBy, user.id],
        deleted_at: message?.deleted_at || new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
      setNotification({ type: 'error', message: 'Failed to delete message' });
    } else {
      setCommunications(prev => prev.map(c =>
        c.id === messageId
          ? { ...c, deleted_by_user: [...currentDeletedBy, user.id] }
          : c
      ));
      setNotification({ type: 'success', message: 'Message deleted' });
    }

    setDeletingMessageId(null);
  };

  const isAdminUser = salesPerson?.role === 'admin' || salesPerson?.role === 'super_admin';

  const filteredCommunications = communications.filter(comm => {
    const matchesSearch =
      (comm.subject?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      comm.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (comm.sender_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || comm.communication_type === filterType;

    const deletedBy = comm.deleted_by_user || [];
    const isDeletedByUser = user?.id ? deletedBy.includes(user.id) : false;

    if (isAdminUser) {
      if (!showDeletedMessages && isDeletedByUser) {
        return false;
      }
      return matchesSearch && matchesType;
    }

    return matchesSearch && matchesType && !isDeletedByUser;
  });

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('sales_people')
      .select('id, user_id, name, email, cell_phone, role')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const fetchUserGroups = async () => {
    const { data: groups, error } = await supabase
      .from('user_groups')
      .select('id, name, description')
      .order('name');

    if (!error && groups) {
      setUserGroups(groups);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      setNotification({ type: 'error', message: 'Please enter a message' });
      return;
    }

    if (communicationType === 'email' && !subject.trim()) {
      setNotification({ type: 'error', message: 'Please enter a subject for the email' });
      return;
    }

    let recipientIds: string[] = [];
    let recipientType: 'individual' | 'group' = 'individual';
    let groupId: string | null = null;

    if (selectedGroup) {
      recipientType = 'group';
      groupId = selectedGroup;

      const { data: members } = await supabase
        .from('user_group_members')
        .select('user_id')
        .eq('group_id', selectedGroup);

      recipientIds = members?.map(m => m.user_id) || [];
    } else if (selectedUsers.length > 0) {
      recipientIds = selectedUsers;
    } else {
      setNotification({ type: 'error', message: 'Please select recipients' });
      return;
    }

    if (recipientIds.length === 0) {
      setNotification({ type: 'error', message: 'No recipients found' });
      return;
    }

    setSending(true);

    try {
      const recipientDetails = await Promise.all(
        recipientIds.map(async (userId) => {
          const { data: userData } = await supabase
            .from('sales_people')
            .select('name, email, cell_phone')
            .eq('user_id', userId)
            .maybeSingle();

          return {
            name: userData?.name || 'Unknown',
            email: userData?.email || '',
            phone: userData?.cell_phone || ''
          };
        })
      );

      const { data: senderData } = await supabase
        .from('sales_people')
        .select('email')
        .eq('user_id', user?.id)
        .maybeSingle();

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-communication`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: communicationType,
            recipients: recipientDetails,
            subject: communicationType === 'email' ? subject : undefined,
            message: message,
            senderEmail: senderData?.email
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      const { error: logError } = await supabase
        .from('communication_logs')
        .insert({
          sent_by: user?.id,
          communication_type: communicationType,
          recipient_type: recipientType,
          recipient_ids: recipientIds,
          group_id: groupId,
          subject: communicationType === 'email' ? subject : null,
          message: message
        });

      if (logError) {
        console.error('Error logging communication:', logError);
      }

      setNotification({ type: 'success', message: `${communicationType === 'email' ? 'Email' : 'SMS'} sent successfully!` });
      setSubject('');
      setMessage('');
      setSelectedUsers([]);
      setSelectedGroup('');

      setTimeout(() => {
        setActiveTab('inbox');
      }, 1500);
    } catch (error) {
      console.error('Error sending message:', error);
      setNotification({ type: 'error', message: error instanceof Error ? error.message : 'Failed to send message' });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {notification && (
        <Toast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <ContactExecutive
        isOpen={showContactExecutive}
        onClose={() => setShowContactExecutive(false)}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Office Communications</h2>
            <p className="text-sm text-gray-600 mt-1">Send and receive messages with your team</p>
          </div>
          <button
            onClick={() => setShowContactExecutive(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-lg shadow-sm transition-all w-full sm:w-auto"
          >
            <AlertCircle className="w-5 h-5" />
            <span>Contact Executives</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === 'inbox'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Inbox
            </div>
          </button>
          <button
            onClick={() => setActiveTab('send')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === 'send'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send Message
            </div>
          </button>
        </div>

        {/* Send Message Tab */}
        {activeTab === 'send' && (
          <div className="space-y-6">
            {/* Communication Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Type
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setCommunicationType('email')}
                  className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                    communicationType === 'email'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Mail className={`w-6 h-6 mx-auto mb-2 ${
                    communicationType === 'email' ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div className="text-sm font-medium">Email</div>
                </button>
                <button
                  onClick={() => setCommunicationType('sms')}
                  className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                    communicationType === 'sms'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <MessageSquare className={`w-6 h-6 mx-auto mb-2 ${
                    communicationType === 'sms' ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div className="text-sm font-medium">SMS</div>
                </button>
              </div>
            </div>

            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send To
              </label>

              {/* Groups */}
              {userGroups.length > 0 && (
                <div className="mb-4">
                  <label className="text-sm text-gray-600 mb-2 block">Your Groups</label>
                  <select
                    value={selectedGroup}
                    onChange={(e) => {
                      setSelectedGroup(e.target.value);
                      if (e.target.value) setSelectedUsers([]);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={selectedUsers.length > 0}
                  >
                    <option value="">Select a group...</option>
                    {userGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Individual Users */}
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Or select individuals</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!!selectedGroup}
                  />
                </div>

                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {filteredUsers.map(u => (
                    <label
                      key={u.id}
                      className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer ${
                        selectedGroup ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u.user_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, u.user_id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== u.user_id));
                          }
                        }}
                        disabled={!!selectedGroup}
                        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{u.name}</div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {selectedUsers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedUsers.map(userId => {
                      const user = users.find(u => u.user_id === userId);
                      return user ? (
                        <span
                          key={userId}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                        >
                          {user.name}
                          <button
                            onClick={() => setSelectedUsers(selectedUsers.filter(id => id !== userId))}
                            className="hover:text-blue-900"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Subject (Email only) */}
            {communicationType === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Enter your ${communicationType === 'email' ? 'email' : 'SMS'} message...`}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Send Button */}
            <div className="flex gap-3">
              <button
                onClick={handleSendMessage}
                disabled={sending}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send {communicationType === 'email' ? 'Email' : 'SMS'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Inbox Tab */}
        {activeTab === 'inbox' && (
          <>
            {/* Search and Filter */}
            <div className="mb-6 flex flex-col gap-4">
              <div className="w-full relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by subject, message, or sender..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                    filterType === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('email')}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 sm:gap-2 text-sm sm:text-base ${
                    filterType === 'email'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </button>
                <button
                  onClick={() => setFilterType('sms')}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 sm:gap-2 text-sm sm:text-base ${
                    filterType === 'sms'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>SMS</span>
                </button>
              </div>
            </div>

            {isAdminUser && (
              <div className="mb-4 flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDeletedMessages}
                    onChange={(e) => setShowDeletedMessages(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-600">Show deleted messages</span>
                </label>
              </div>
            )}

            {/* Communications List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 mt-2">Loading communications...</p>
              </div>
            ) : filteredCommunications.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No communications found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCommunications.map((comm) => {
                  const deletedBy = comm.deleted_by_user || [];
                  const isDeleted = user?.id ? deletedBy.includes(user.id) : false;
                  const hasAnyDeletions = deletedBy.length > 0;

                  return (
                    <div
                      key={comm.id}
                      className={`border rounded-lg p-3 sm:p-4 transition-colors w-full ${
                        isDeleted
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-0 mb-2">
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${
                            comm.communication_type === 'email'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {comm.communication_type === 'email' ? (
                              <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                            ) : (
                              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                              <span className="font-semibold text-gray-900 text-sm sm:text-base">
                                {comm.sender_name}
                              </span>
                              {comm.recipient_type === 'group' && comm.group_name && (
                                <span className="flex items-center gap-1 text-xs sm:text-sm text-gray-600">
                                  <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                                  {comm.group_name}
                                </span>
                              )}
                              {isAdminUser && hasAnyDeletions && (
                                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                  <Trash2 className="w-3 h-3" />
                                  <span className="hidden sm:inline">Deleted by {deletedBy.length} user{deletedBy.length !== 1 ? 's' : ''}</span>
                                  <span className="sm:hidden">{deletedBy.length}</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 mt-0.5">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="truncate">{formatDate(comm.sent_at)}</span>
                            </div>
                          </div>
                        </div>
                        {!isDeleted && (
                          <button
                            onClick={() => handleDeleteMessage(comm.id)}
                            disabled={deletingMessageId === comm.id}
                            className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-start shrink-0"
                            title="Delete message"
                          >
                            {deletingMessageId === comm.id ? (
                              <div className="w-4 h-4 sm:w-5 sm:h-5 animate-spin rounded-full border-2 border-gray-300 border-t-red-600" />
                            ) : (
                              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                          </button>
                        )}
                      </div>

                      {comm.subject && (
                        <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base break-words">{comm.subject}</h3>
                      )}

                      <p className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base break-words">{comm.message}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
