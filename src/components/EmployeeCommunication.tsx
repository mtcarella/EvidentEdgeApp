import { useState, useEffect } from 'react';
import { Send, Users, Mail, MessageSquare, Plus, X, CreditCard as Edit2, Trash2, UserPlus, UserMinus, Search, Clock, AlertCircle } from 'lucide-react';
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
  created_by: string;
  created_at: string;
  member_count?: number;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  added_at: string;
  user_name?: string;
  user_email?: string;
  user_cell_phone?: string;
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
}

type Tab = 'groups' | 'history';

export default function EmployeeCommunication() {
  const { user, salesPerson } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('groups');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [communicationType, setCommunicationType] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Group management states
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  // Communication history
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Contact Executive modal
  const [showContactExecutive, setShowContactExecutive] = useState(false);

  // Check if user is admin or super admin
  const isAdminOrSuperAdmin = salesPerson?.role === 'admin' || salesPerson?.role === 'super_admin';

  useEffect(() => {
    fetchUsers();
    fetchGroups();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchCommunicationLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (managingGroupId) {
      fetchGroupMembers(managingGroupId);
    }
  }, [managingGroupId]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('sales_people')
      .select('id, user_id, name, email, cell_phone, role')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    setUsers(data || []);
  };

  const fetchGroups = async () => {
    const { data: groupsData, error } = await supabase
      .from('user_groups')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching groups:', error);
      return;
    }

    // Get member counts for each group
    const groupsWithCounts = await Promise.all(
      (groupsData || []).map(async (group) => {
        const { count } = await supabase
          .from('user_group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);

        return { ...group, member_count: count || 0 };
      })
    );

    setGroups(groupsWithCounts);
  };

  const fetchGroupMembers = async (groupId: string) => {
    const { data, error } = await supabase
      .from('user_group_members')
      .select(`
        id,
        group_id,
        user_id,
        added_at
      `)
      .eq('group_id', groupId);

    if (error) {
      console.error('Error fetching group members:', error);
      return;
    }

    // Enrich with user details
    const membersWithDetails = await Promise.all(
      (data || []).map(async (member) => {
        const { data: userData } = await supabase
          .from('sales_people')
          .select('name, email, cell_phone')
          .eq('user_id', member.user_id)
          .maybeSingle();

        return {
          ...member,
          user_name: userData?.name || 'Unknown',
          user_email: userData?.email || '',
          user_cell_phone: userData?.cell_phone || ''
        };
      })
    );

    setGroupMembers(membersWithDetails);
  };

  const fetchCommunicationLogs = async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching communication logs:', error);
      setLoadingLogs(false);
      return;
    }

    // Enrich with sender names
    const logsWithDetails = await Promise.all(
      (data || []).map(async (log) => {
        if (log.sent_by) {
          const { data: userData } = await supabase
            .from('sales_people')
            .select('name')
            .eq('user_id', log.sent_by)
            .maybeSingle();

          return { ...log, sender_name: userData?.name || 'Unknown' };
        }
        return { ...log, sender_name: 'Unknown' };
      })
    );

    setCommunicationLogs(logsWithDetails);
    setLoadingLogs(false);
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
      // Sending to a group
      recipientType = 'group';
      groupId = selectedGroup;

      const { data: members } = await supabase
        .from('user_group_members')
        .select('user_id')
        .eq('group_id', selectedGroup);

      recipientIds = members?.map(m => m.user_id) || [];
    } else if (selectedUsers.length > 0) {
      // Sending to individual users
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
      // Get recipient details
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

      // Get sender's email
      const { data: senderData } = await supabase
        .from('sales_people')
        .select('email')
        .eq('user_id', user?.id)
        .maybeSingle();

      // Call edge function to send messages
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

      // Log the communication
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

      if (result.success) {
        setNotification({
          type: 'success',
          message: `Message sent successfully to ${result.sent} recipient(s) via ${communicationType.toUpperCase()}!`
        });
      } else {
        setNotification({
          type: 'error',
          message: `Sent to ${result.sent} recipients, but ${result.failed} failed. Check the configuration or contact your administrator.`
        });
      }

      // Reset form
      setSelectedUsers([]);
      setSelectedGroup('');
      setSubject('');
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send message. Please contact your administrator.'
      });
    } finally {
      setSending(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setNotification({ type: 'error', message: 'Please enter a group name' });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_groups')
        .insert({
          name: newGroupName,
          description: newGroupDescription || null,
          created_by: user?.id
        });

      if (error) throw error;

      setNotification({ type: 'success', message: 'Group created successfully' });
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupDescription('');
      fetchGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      setNotification({ type: 'error', message: 'Failed to create group' });
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !newGroupName.trim()) {
      setNotification({ type: 'error', message: 'Please enter a group name' });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_groups')
        .update({
          name: newGroupName,
          description: newGroupDescription || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingGroup.id);

      if (error) throw error;

      setNotification({ type: 'success', message: 'Group updated successfully' });
      setEditingGroup(null);
      setNewGroupName('');
      setNewGroupDescription('');
      fetchGroups();
    } catch (error) {
      console.error('Error updating group:', error);
      setNotification({ type: 'error', message: 'Failed to update group' });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This will remove all members from the group.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      setNotification({ type: 'success', message: 'Group deleted successfully' });
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      setNotification({ type: 'error', message: 'Failed to delete group' });
    }
  };

  const handleAddMemberToGroup = async (userId: string) => {
    if (!managingGroupId) return;

    try {
      const { error } = await supabase
        .from('user_group_members')
        .insert({
          group_id: managingGroupId,
          user_id: userId
        });

      if (error) {
        if (error.code === '23505') {
          setNotification({ type: 'error', message: 'User is already in this group' });
        } else {
          throw error;
        }
        return;
      }

      setNotification({ type: 'success', message: 'Member added successfully' });
      fetchGroupMembers(managingGroupId);
      fetchGroups();
    } catch (error) {
      console.error('Error adding member:', error);
      setNotification({ type: 'error', message: 'Failed to add member' });
    }
  };

  const handleRemoveMemberFromGroup = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('user_group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setNotification({ type: 'success', message: 'Member removed successfully' });
      if (managingGroupId) {
        fetchGroupMembers(managingGroupId);
        fetchGroups();
      }
    } catch (error) {
      console.error('Error removing member:', error);
      setNotification({ type: 'error', message: 'Failed to remove member' });
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRecipientNames = (recipientIds: string[]) => {
    return recipientIds.map(id => {
      const user = users.find(u => u.user_id === id);
      return user?.name || 'Unknown';
    }).join(', ');
  };

  const handleDeleteCommunicationLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this communication log? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('communication_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      setNotification({ type: 'success', message: 'Communication log deleted successfully' });
      setCommunicationLogs(prev => prev.filter(log => log.id !== logId));
    } catch (error) {
      console.error('Error deleting communication log:', error);
      setNotification({ type: 'error', message: 'Failed to delete communication log' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
          duration={5000}
        />
      )}

      <ContactExecutive
        isOpen={showContactExecutive}
        onClose={() => setShowContactExecutive(false)}
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100">
            <h2 className="text-2xl font-bold text-gray-900">Manage Office Communications</h2>
            <p className="text-sm text-gray-600 mt-1">Administrator tools for managing groups and viewing communication history</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex gap-1 flex-1">
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'groups'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Users className="w-5 h-5" />
              Manage Groups
            </button>
            {isAdminOrSuperAdmin && (
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-5 h-5" />
                History
              </button>
            )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'groups' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">User Groups</h3>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Group
                </button>
              </div>

              {(showCreateGroup || editingGroup) && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                  <h4 className="font-medium text-slate-800 mb-3">
                    {editingGroup ? 'Edit Group' : 'Create New Group'}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Enter group name..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                      <textarea
                        value={newGroupDescription}
                        onChange={(e) => setNewGroupDescription(e.target.value)}
                        placeholder="Enter group description..."
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        {editingGroup ? 'Update Group' : 'Create Group'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateGroup(false);
                          setEditingGroup(null);
                          setNewGroupName('');
                          setNewGroupDescription('');
                        }}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4">
                {groups.map(group => (
                  <div key={group.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800">{group.name}</h4>
                        {group.description && (
                          <p className="text-sm text-slate-600 mt-1">{group.description}</p>
                        )}
                        <p className="text-sm text-slate-500 mt-1">
                          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingGroup(group);
                            setNewGroupName(group.name);
                            setNewGroupDescription(group.description || '');
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit group"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setManagingGroupId(managingGroupId === group.id ? null : group.id)}
                          className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                          title="Manage members"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete group"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {managingGroupId === group.id && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <h5 className="font-medium text-slate-700 mb-3">Group Members</h5>

                        <div className="mb-3">
                          <label className="block text-sm text-slate-600 mb-2">Add Member</label>
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddMemberToGroup(e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">-- Select User to Add --</option>
                            {users
                              .filter(u => !groupMembers.find(m => m.user_id === u.user_id))
                              .map(u => (
                                <option key={u.id} value={u.user_id}>
                                  {u.name} ({u.email})
                                </option>
                              ))
                            }
                          </select>
                        </div>

                        <div className="space-y-2">
                          {groupMembers.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                              <div>
                                <div className="font-medium text-slate-800">{member.user_name}</div>
                                <div className="text-sm text-slate-600">{member.user_email}</div>
                                {member.user_cell_phone && (
                                  <div className="text-sm text-slate-500">{member.user_cell_phone}</div>
                                )}
                              </div>
                              <button
                                onClick={() => handleRemoveMemberFromGroup(member.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Remove member"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          {groupMembers.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-4">No members in this group yet</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="text-center text-slate-500 py-8">No groups created yet</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Communication History</h3>

              {loadingLogs ? (
                <p className="text-center text-slate-500 py-8">Loading...</p>
              ) : communicationLogs.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No communications sent yet</p>
              ) : (
                <div className="space-y-4">
                  {communicationLogs.map(log => (
                    <div key={log.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {log.communication_type === 'email' ? (
                            <Mail className="w-5 h-5 text-blue-600" />
                          ) : (
                            <MessageSquare className="w-5 h-5 text-green-600" />
                          )}
                          <div>
                            <h4 className="font-semibold text-slate-800">
                              {log.subject || 'SMS Message'}
                            </h4>
                            <p className="text-sm text-slate-600">
                              Sent by {log.sender_name} on {new Date(log.sent_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            log.communication_type === 'email'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {log.communication_type.toUpperCase()}
                          </span>
                          <button
                            onClick={() => handleDeleteCommunicationLog(log.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete communication log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 mb-2 whitespace-pre-wrap">{log.message}</p>
                      <p className="text-xs text-slate-500">
                        Recipients ({log.recipient_ids.length}): {getRecipientNames(log.recipient_ids)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
