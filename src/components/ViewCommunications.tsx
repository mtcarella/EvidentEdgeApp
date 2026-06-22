import { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, MessageSquare, Search, Clock, Users, Send, X, AlertCircle, Trash2, Paperclip, Reply, FileText, Download, Image, File, ChevronLeft, ArrowUpDown, Circle, CheckCheck, Eye, EyeOff } from 'lucide-react';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from './Toast';
import ContactExecutive from './ContactExecutive';
import { ThreadManagement } from './ThreadManagement';

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

interface Attachment {
  id: string;
  communication_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
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
  reply_to_message_id?: string | null;
  attachments?: Attachment[];
  replies?: CommunicationLog[];
}

interface PendingFile {
  file: File;
  preview: string | null;
  name: string;
  size: number;
  type: string;
}

type Tab = 'send' | 'inbox' | 'thread' | 'managed';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
];
const ALL_ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOC_TYPES];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(type);
}

export function ViewCommunications() {
  const { user, salesPerson } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'email' | 'sms'>('all');

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

  // Attachment state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reply state
  const [replyToMessage, setReplyToMessage] = useState<CommunicationLog | null>(null);

  // Read/unread tracking
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const markAsReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Thread view state
  const [threadParent, setThreadParent] = useState<CommunicationLog | null>(null);
  const [threadMessages, setThreadMessages] = useState<CommunicationLog[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadReturnTab, setThreadReturnTab] = useState<'inbox' | 'managed'>('inbox');
  const [threadReplyMessage, setThreadReplyMessage] = useState('');
  const [threadPendingFiles, setThreadPendingFiles] = useState<PendingFile[]>([]);
  const [threadSending, setThreadSending] = useState(false);
  const threadFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id || !salesPerson) return;
    fetchCommunications();
    fetchUsers();
    fetchUserGroups();
    fetchReadIds();
  }, [user?.id, salesPerson?.role]);

  useEffect(() => {
    if (activeTab === 'inbox' && salesPerson) {
      fetchCommunications();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('office-communications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communication_logs' }, () => {
        fetchCommunications();
        if (threadParent) {
          loadThread(threadParent.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communication_reads' }, () => {
        fetchReadIds();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, threadParent?.id]);

  useEffect(() => {
    return () => {
      if (markAsReadTimerRef.current) {
        clearTimeout(markAsReadTimerRef.current);
      }
    };
  }, []);

  const fetchReadIds = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('communication_reads')
      .select('communication_id')
      .eq('user_id', user.id);
    if (data) {
      setReadIds(new Set(data.map(r => r.communication_id)));
    }
  };

  const markCommunicationsAsRead = async (commIds: string[]) => {
    if (!user?.id || commIds.length === 0) return;

    const unreadIds = commIds.filter(id => !readIds.has(id));
    if (unreadIds.length === 0) return;

    const inserts = unreadIds.map(commId => ({
      communication_id: commId,
      user_id: user.id
    }));

    await supabase
      .from('communication_reads')
      .upsert(inserts, { onConflict: 'communication_id,user_id', ignoreDuplicates: true });

    setReadIds(prev => {
      const next = new Set(prev);
      unreadIds.forEach(id => next.add(id));
      return next;
    });
  };

  const markAsUnread = async (commId: string) => {
    if (!user?.id) return;
    await supabase
      .from('communication_reads')
      .delete()
      .eq('communication_id', commId)
      .eq('user_id', user.id);

    setReadIds(prev => {
      const next = new Set(prev);
      next.delete(commId);
      return next;
    });
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    const unreadComms = communications.filter(c => {
      const deletedBy = c.deleted_by_user || [];
      return !readIds.has(c.id) && !deletedBy.includes(user.id);
    });
    if (unreadComms.length === 0) return;
    await markCommunicationsAsRead(unreadComms.map(c => c.id));
  };

  const fetchCommunications = async () => {
    if (!user?.id || !salesPerson) return;

    setLoading(true);

    let query = supabase
      .from('communication_logs')
      .select('*')
      .is('reply_to_message_id', null)
      .or(`recipient_ids.cs.["${user.id}"],sent_by.eq.${user.id}`);

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

        const { data: attachments } = await supabase
          .from('communication_attachments')
          .select('*')
          .eq('communication_id', log.id);

        const { data: replyData } = await supabase
          .from('communication_logs')
          .select('id')
          .eq('reply_to_message_id', log.id);

        return {
          ...log,
          sender_name: senderData?.name || 'Unknown',
          group_name: groupName,
          attachments: attachments || [],
          _replyCount: replyData?.length || 0,
          _replyIds: replyData?.map(r => r.id) || []
        };
      })
    );

    setCommunications(logsWithDetails);
    setLoading(false);
  };

  const loadThread = async (parentId: string) => {
    setThreadLoading(true);

    const { data: parent } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('id', parentId)
      .maybeSingle();

    if (!parent) {
      setThreadLoading(false);
      return;
    }

    const { data: senderData } = await supabase
      .from('sales_people')
      .select('name')
      .eq('user_id', parent.sent_by)
      .maybeSingle();

    const { data: parentAttachments } = await supabase
      .from('communication_attachments')
      .select('*')
      .eq('communication_id', parent.id);

    const parentWithDetails: CommunicationLog = {
      ...parent,
      sender_name: senderData?.name || 'Unknown',
      attachments: parentAttachments || []
    };

    setThreadParent(parentWithDetails);

    const { data: replies } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('reply_to_message_id', parentId)
      .order('sent_at', { ascending: true });

    const repliesWithDetails = await Promise.all(
      (replies || []).map(async (reply) => {
        const { data: replySender } = await supabase
          .from('sales_people')
          .select('name')
          .eq('user_id', reply.sent_by)
          .maybeSingle();

        const { data: replyAttachments } = await supabase
          .from('communication_attachments')
          .select('*')
          .eq('communication_id', reply.id);

        return {
          ...reply,
          sender_name: replySender?.name || 'Unknown',
          attachments: replyAttachments || []
        };
      })
    );

    setThreadMessages(repliesWithDetails);
    setThreadLoading(false);
  };

  const openThread = (comm: CommunicationLog) => {
    loadThread(comm.id);
    setThreadReturnTab('inbox');
    setActiveTab('thread');

    if (markAsReadTimerRef.current) {
      clearTimeout(markAsReadTimerRef.current);
    }
    markAsReadTimerRef.current = setTimeout(() => {
      markCommunicationsAsRead([comm.id]);
    }, 2000);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.id) return;

    setDeletingMessageId(messageId);

    const msg = communications.find(c => c.id === messageId);
    const currentDeletedBy = msg?.deleted_by_user || [];

    const { error } = await supabase
      .from('communication_logs')
      .update({
        deleted_by_user: [...currentDeletedBy, user.id],
        deleted_at: msg?.deleted_at || new Date().toISOString()
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

  // -- File Attachment Handlers --

  const compressImage = (file: File, maxWidth = 1920): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not get canvas context')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Compression failed'));
          },
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          0.8
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });
  };

  const compressDocument = async (file: File): Promise<Blob> => {
    const zip = new JSZip();
    const arrayBuffer = await file.arrayBuffer();
    zip.file(file.name, arrayBuffer);
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isThread = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: PendingFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!ALL_ACCEPTED_TYPES.includes(file.type)) {
        setNotification({ type: 'error', message: `File type not supported: ${file.name}` });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setNotification({ type: 'error', message: `File too large (max 10MB): ${file.name}` });
        continue;
      }

      let preview: string | null = null;
      if (isImageType(file.type)) {
        preview = URL.createObjectURL(file);
      }

      newFiles.push({ file, preview, name: file.name, size: file.size, type: file.type });
    }

    if (isThread) {
      setThreadPendingFiles(prev => [...prev, ...newFiles]);
    } else {
      setPendingFiles(prev => [...prev, ...newFiles]);
    }

    e.target.value = '';
  };

  const removePendingFile = (index: number, isThread = false) => {
    if (isThread) {
      setThreadPendingFiles(prev => {
        const updated = [...prev];
        if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!);
        updated.splice(index, 1);
        return updated;
      });
    } else {
      setPendingFiles(prev => {
        const updated = [...prev];
        if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!);
        updated.splice(index, 1);
        return updated;
      });
    }
  };

  const uploadFiles = async (communicationId: string, files: PendingFile[]): Promise<boolean> => {
    if (files.length === 0) return true;

    setUploadProgress(0);
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const pf = files[i];
      let fileToUpload: Blob = pf.file;
      let fileName = pf.name;

      try {
        if (isImageType(pf.type)) {
          fileToUpload = await compressImage(pf.file);
        } else {
          fileToUpload = await compressDocument(pf.file);
          fileName = `${pf.name}.zip`;
        }

        if (fileToUpload.size > MAX_FILE_SIZE) {
          setNotification({ type: 'error', message: `File still too large after compression: ${pf.name}` });
          setUploadProgress(null);
          return false;
        }

        const filePath = `${user!.id}/${communicationId}/${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('communication-attachments')
          .upload(filePath, fileToUpload, { contentType: pf.type });

        if (uploadError) {
          setNotification({ type: 'error', message: `Upload failed: ${pf.name}` });
          setUploadProgress(null);
          return false;
        }

        const { data: urlData } = supabase.storage
          .from('communication-attachments')
          .getPublicUrl(filePath);

        await supabase.from('communication_attachments').insert({
          communication_id: communicationId,
          file_name: pf.name,
          file_url: urlData.publicUrl,
          file_type: pf.type,
          file_size: fileToUpload.size
        });

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      } catch (err) {
        console.error('Error uploading file:', err);
        setNotification({ type: 'error', message: `Failed to process: ${pf.name}` });
        setUploadProgress(null);
        return false;
      }
    }

    setUploadProgress(null);
    return true;
  };

  // -- Send Message --

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

    if (replyToMessage) {
      recipientIds = [replyToMessage.sent_by];
      recipientType = 'individual';
    } else if (selectedGroup) {
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
            senderEmail: senderData?.email,
            sendCopyToSender: false
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      const { data: logData, error: logError } = await supabase
        .from('communication_logs')
        .insert({
          sent_by: user?.id,
          communication_type: communicationType,
          recipient_type: recipientType,
          recipient_ids: recipientIds,
          group_id: groupId,
          subject: communicationType === 'email' ? subject : null,
          message: message,
          reply_to_message_id: replyToMessage?.id || null
        })
        .select('id')
        .single();

      if (logError) {
        console.error('Error logging communication:', logError);
        throw new Error('Failed to save message');
      }

      if (pendingFiles.length > 0 && logData) {
        const uploaded = await uploadFiles(logData.id, pendingFiles);
        if (!uploaded) {
          throw new Error('File upload failed');
        }
      }

      if (!replyToMessage) {
        try {
          const { data: { session: notifySession } } = await supabase.auth.getSession();
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-communication`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${notifySession?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recipientUserIds: recipientIds,
                subject: subject || '',
                message: message,
                senderName: salesPerson?.name || 'Unknown',
                communicationId: logData?.id || '',
                appUrl: window.location.origin,
              })
            }
          );
        } catch (notifyError) {
          console.error('Error sending email notifications:', notifyError);
        }
      }

      setNotification({ type: 'success', message: `${communicationType === 'email' ? 'Email' : 'SMS'} sent successfully!` });
      setSubject('');
      setMessage('');
      setSelectedUsers([]);
      setSelectedGroup('');
      setPendingFiles([]);
      setReplyToMessage(null);

      fetchCommunications();

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

  const handleSendThreadReply = async () => {
    if (!threadReplyMessage.trim() || !threadParent) return;

    setThreadSending(true);

    try {
      const recipientIds = threadParent.sent_by === user?.id
        ? threadParent.recipient_ids
        : [threadParent.sent_by];

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
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-communication`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: threadParent.communication_type,
            recipients: recipientDetails,
            subject: threadParent.subject ? `Re: ${threadParent.subject}` : undefined,
            message: threadReplyMessage,
            senderEmail: senderData?.email,
            sendCopyToSender: false
          })
        }
      );

      const { data: logData, error: logError } = await supabase
        .from('communication_logs')
        .insert({
          sent_by: user?.id,
          communication_type: threadParent.communication_type,
          recipient_type: 'individual',
          recipient_ids: recipientIds,
          group_id: null,
          subject: threadParent.subject ? `Re: ${threadParent.subject}` : null,
          message: threadReplyMessage,
          reply_to_message_id: threadParent.id
        })
        .select('id')
        .single();

      if (logError) throw new Error('Failed to save reply');

      if (threadPendingFiles.length > 0 && logData) {
        await uploadFiles(logData.id, threadPendingFiles);
      }

      setThreadReplyMessage('');
      setThreadPendingFiles([]);
      setNotification({ type: 'success', message: 'Reply sent!' });
      loadThread(threadParent.id);
    } catch (error) {
      console.error('Error sending reply:', error);
      setNotification({ type: 'error', message: error instanceof Error ? error.message : 'Failed to send reply' });
    } finally {
      setThreadSending(false);
    }
  };

  const handleReplyFromInbox = (comm: CommunicationLog) => {
    setReplyToMessage(comm);
    setSubject(comm.subject ? `Re: ${comm.subject}` : '');
    setCommunicationType(comm.communication_type);
    setActiveTab('send');
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
      if (!showDeletedMessages && isDeletedByUser) return false;
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

    if (!error && data) setUsers(data);
  };

  const fetchUserGroups = async () => {
    const { data: groups, error } = await supabase
      .from('user_groups')
      .select('id, name, description')
      .order('name');

    if (!error && groups) setUserGroups(groups);
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

  // -- Render Helpers --

  const renderAttachments = (attachments: Attachment[] | undefined) => {
    if (!attachments || attachments.length === 0) return null;

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {attachments.map(att => (
          <a
            key={att.id}
            href={att.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            {isImageType(att.file_type) ? (
              <div className="flex items-center gap-2">
                <img
                  src={att.file_url}
                  alt={att.file_name}
                  className="w-10 h-10 object-cover rounded"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate max-w-[120px]">{att.file_name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(att.file_size)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate max-w-[120px]">{att.file_name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(att.file_size)}</p>
                </div>
              </div>
            )}
            <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
          </a>
        ))}
      </div>
    );
  };

  const renderPendingFiles = (files: PendingFile[], isThread = false) => {
    if (files.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {files.map((pf, idx) => (
          <div key={idx} className="relative flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
            {pf.preview ? (
              <img src={pf.preview} alt={pf.name} className="w-10 h-10 object-cover rounded" />
            ) : (
              <File className="w-5 h-5 text-gray-500" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate max-w-[100px]">{pf.name}</p>
              <p className="text-xs text-gray-400">{formatFileSize(pf.size)}</p>
            </div>
            <button
              onClick={() => removePendingFile(idx, isThread)}
              className="ml-1 text-gray-400 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // -- Thread View --

  const renderThreadView = () => {
    if (threadLoading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-2">Loading thread...</p>
        </div>
      );
    }

    if (!threadParent) return null;

    return (
      <div className="space-y-4">
        <button
          onClick={() => { setActiveTab(threadReturnTab); setThreadParent(null); setThreadMessages([]); setThreadReturnTab('inbox'); }}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          {threadReturnTab === 'managed' ? 'Back to Threads' : 'Back to Inbox'}
        </button>

        <div className="border-b border-gray-200 pb-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {threadParent.subject || 'No Subject'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Started by {threadParent.sender_name} on {formatDate(threadParent.sent_at)}
          </p>
        </div>

        {/* Thread messages */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {/* Unread reply summary */}
          {(() => {
            const unreadCount = threadMessages.filter(r => !readIds.has(r.id)).length;
            return unreadCount > 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <Circle className="w-2.5 h-2.5 fill-blue-500 text-blue-500" />
                <span className="font-medium text-blue-700">{unreadCount} unread {unreadCount === 1 ? 'reply' : 'replies'}</span>
              </div>
            ) : null;
          })()}

          {/* Parent message */}
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900 text-sm">{threadParent.sender_name}</span>
              <span className="text-xs text-gray-500">{formatDate(threadParent.sent_at)}</span>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap text-sm">{threadParent.message}</p>
            {renderAttachments(threadParent.attachments)}
          </div>

          {/* Replies */}
          {threadMessages.map((reply) => {
            const isSelf = reply.sent_by === user?.id;
            const isReplyUnread = !readIds.has(reply.id);
            return (
              <ReplyItem
                key={reply.id}
                reply={reply}
                isSelf={isSelf}
                isUnread={isReplyUnread}
                onRead={() => markCommunicationsAsRead([reply.id])}
                formatDate={formatDate}
                renderAttachments={renderAttachments}
              />
            );
          })}
        </div>

        {/* Reply composer */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Reply className="w-3 h-3" />
              Replying to {threadParent.sender_name}
            </div>
            <p className="text-xs text-gray-600 truncate">{threadParent.message.slice(0, 100)}{threadParent.message.length > 100 ? '...' : ''}</p>
          </div>

          <textarea
            value={threadReplyMessage}
            onChange={(e) => setThreadReplyMessage(e.target.value)}
            placeholder="Type your reply..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />

          {renderPendingFiles(threadPendingFiles, true)}

          <div className="flex items-center gap-2 mt-3">
            <input
              ref={threadFileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, true)}
            />
            <button
              onClick={() => threadFileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              onClick={handleSendThreadReply}
              disabled={threadSending || !threadReplyMessage.trim()}
              className="ml-auto flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium text-sm"
            >
              {threadSending ? (
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Reply
            </button>
          </div>

          {uploadProgress !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Uploading files...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

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
        {activeTab !== 'thread' && (
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
            <button
              onClick={() => setActiveTab('managed')}
              className={`px-4 py-2 font-medium transition-colors relative ${
                activeTab === 'managed'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" />
                Threads
              </div>
            </button>
          </div>
        )}

        {/* Thread View */}
        {activeTab === 'thread' && renderThreadView()}

        {/* Send Message Tab */}
        {activeTab === 'send' && (
          <div className="space-y-6">
            {/* Reply context bar */}
            {replyToMessage && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Reply className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-blue-600 font-medium">Replying to {replyToMessage.sender_name}</p>
                  <p className="text-sm text-gray-700 truncate mt-0.5">{replyToMessage.message.slice(0, 150)}</p>
                </div>
                <button
                  onClick={() => { setReplyToMessage(null); setSubject(''); }}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Communication Type Selection */}
            {!replyToMessage && (
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
            )}

            {/* Recipients - hide when replying */}
            {!replyToMessage && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send To
                </label>

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
                          {u.cell_phone && (
                            <div className="text-sm text-gray-400">{u.cell_phone}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>

                  {selectedUsers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedUsers.map(userId => {
                        const usr = users.find(u => u.user_id === userId);
                        return usr ? (
                          <span
                            key={userId}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {usr.name}
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
            )}

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

            {/* Pending files preview */}
            {renderPendingFiles(pendingFiles)}

            {/* Upload progress */}
            {uploadProgress !== null && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Uploading files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            {/* Send Button + Attach */}
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e, false)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5" />
                <span className="hidden sm:inline">Attach</span>
              </button>
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

        {/* Managed Threads Tab */}
        {activeTab === 'managed' && (
          <ThreadManagement
            onThreadSelect={(threadId) => {
              loadThread(threadId);
              setThreadReturnTab('managed');
              setActiveTab('thread');
            }}
          />
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

            {/* Unread Actions Bar */}
            {(() => {
              const unreadCount = communications.filter(c => {
                const deletedBy = c.deleted_by_user || [];
                return !readIds.has(c.id) && (!user?.id || !deletedBy.includes(user.id));
              }).length;
              return unreadCount > 0 ? (
                <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-blue-700">
                    {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark All as Read
                  </button>
                </div>
              ) : null;
            })()}

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
              <div className="space-y-3">
                {filteredCommunications.map((comm) => {
                  const deletedBy = comm.deleted_by_user || [];
                  const isDeleted = user?.id ? deletedBy.includes(user.id) : false;
                  const hasAnyDeletions = deletedBy.length > 0;
                  const replyCount = (comm as CommunicationLog & { _replyCount?: number })._replyCount || 0;
                  const replyIds = (comm as CommunicationLog & { _replyIds?: string[] })._replyIds || [];
                  const unreadReplyCount = replyIds.filter(id => !readIds.has(id)).length;
                  const isUnread = !readIds.has(comm.id);

                  return (
                    <div
                      key={comm.id}
                      className={`border rounded-lg p-3 sm:p-4 transition-all w-full group ${
                        isDeleted
                          ? 'border-red-200 bg-red-50'
                          : isUnread
                            ? 'border-l-4 border-l-blue-500 border-t border-r border-b border-blue-200 bg-blue-50/40 hover:bg-blue-50/70 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-0 mb-2">
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                          {/* Unread dot indicator */}
                          {isUnread && !isDeleted && (
                            <div className="flex-shrink-0 mt-2">
                              <Circle className="w-2.5 h-2.5 fill-blue-500 text-blue-500" />
                            </div>
                          )}
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
                              <span className={`text-sm sm:text-base ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
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
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Mark as read/unread toggle */}
                          {!isDeleted && (
                            <button
                              onClick={() => isUnread ? markCommunicationsAsRead([comm.id]) : markAsUnread(comm.id)}
                              className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title={isUnread ? 'Mark as read' : 'Mark as unread'}
                            >
                              {isUnread ? (
                                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                              ) : (
                                <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                              )}
                            </button>
                          )}
                          {/* Reply button */}
                          {!isDeleted && (
                            <button
                              onClick={() => handleReplyFromInbox(comm)}
                              className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          )}
                          {/* Delete button */}
                          {!isDeleted && (
                            <button
                              onClick={() => handleDeleteMessage(comm.id)}
                              disabled={deletingMessageId === comm.id}
                              className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
                      </div>

                      {comm.subject && (
                        <h3 className={`mb-2 text-sm sm:text-base break-words ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{comm.subject}</h3>
                      )}

                      <p className={`whitespace-pre-wrap text-sm sm:text-base break-words ${isUnread ? 'text-gray-800' : 'text-gray-600'}`}>{comm.message}</p>

                      {renderAttachments(comm.attachments)}

                      {/* Thread indicator + View thread */}
                      {replyCount > 0 && (
                        <button
                          onClick={() => openThread(comm)}
                          className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <MessageSquare className="w-4 h-4" />
                          {replyCount} {replyCount === 1 ? 'reply' : 'replies'} - View thread
                          {unreadReplyCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                              {unreadReplyCount} unread
                            </span>
                          )}
                        </button>
                      )}

                      {replyCount === 0 && !isDeleted && (
                        <button
                          onClick={() => openThread(comm)}
                          className="mt-3 flex items-center gap-2 text-xs text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Open thread
                        </button>
                      )}
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

interface ReplyItemProps {
  reply: {
    id: string;
    sent_by: string;
    sender_name?: string;
    sent_at: string;
    message: string;
    attachments?: unknown[];
  };
  isSelf: boolean;
  isUnread: boolean;
  onRead: () => void;
  formatDate: (date: string) => string;
  renderAttachments: (attachments: unknown[] | undefined) => React.ReactNode;
}

function ReplyItem({ reply, isSelf, isUnread, onRead, formatDate, renderAttachments }: ReplyItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useEffect(() => {
    if (!isUnread || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timerRef.current = setTimeout(() => {
            onReadRef.current();
          }, 3000);
        } else {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isUnread]);

  return (
    <div
      ref={ref}
      className={`ml-6 border rounded-lg p-4 transition-all ${
        isUnread
          ? 'border-l-4 border-l-blue-500 border-t border-r border-b border-blue-200 bg-blue-50/30 shadow-sm'
          : isSelf
            ? 'border-green-200 bg-green-50'
            : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {isUnread && (
          <Circle className="w-2 h-2 fill-blue-500 text-blue-500 flex-shrink-0" />
        )}
        <Reply className="w-3 h-3 text-gray-400" />
        <span className={`text-sm ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>
          {reply.sender_name}
        </span>
        <span className="text-xs text-gray-500">{formatDate(reply.sent_at)}</span>
        {isUnread && (
          <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">New</span>
        )}
      </div>
      <p className={`whitespace-pre-wrap text-sm ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>{reply.message}</p>
      {renderAttachments(reply.attachments)}
    </div>
  );
}
