import { useState, useEffect, useRef, useCallback } from 'react';
import { LogOut, Search as SearchIcon, UserPlus, History, Upload, Shield, Database, Users, FileCheck, AlertCircle, FileText, Key, Award, DollarSign, Calendar, ClipboardList, ChevronDown, Settings, Mail, Bell, Megaphone, MessageSquare, MessageCircle, Clock, Coffee, Briefcase, Palmtree, X, Ticket, FileSearch } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { useDeviceDetection } from '../lib/deviceDetection';
import { useModulePermissions } from '../hooks/useModulePermissions';
import { supabase } from '../lib/supabase';
import { nowInEST } from '../lib/dateUtils';
import { ContactSearch } from './ContactSearch';
import { AddProspect } from './AddProspect';
import { AuditLog } from './AuditLog';
import { ImportData } from './ImportData';
import { AdminPanel } from './AdminPanel';
import { MyContacts } from './MyContacts';
import { WireManagement } from './WireManagement';
import { ConflictCheck } from './ConflictCheck';
import { Resources } from './Resources';
import CloserSubmissions from './CloserSubmissions';
import CloserRewardsReport from './CloserRewardsReport';
import { MeetingLogsReport } from './MeetingLogsReport';
import ProcessorReportForm from './ProcessorReportForm';
import WeeklyReportsView from './WeeklyReportsView';
import { Announcements } from './Announcements';
import { AnnouncementsArchive } from './AnnouncementsArchive';
import { AnnouncementsAdmin } from './AnnouncementsAdmin';
import EmployeeCommunication from './EmployeeCommunication';
import { LoginAnnouncementsModal } from './LoginAnnouncementsModal';
import SMSOptInModal from './SMSOptInModal';
import { SMSOptInManagement } from './SMSOptInManagement';
import { ViewCommunications } from './ViewCommunications';
import { UploadResource } from './UploadResource';
import { DirectMessages } from './DirectMessages';
import { YankeesTickets } from './YankeesTickets';
import { ProspectRequests } from './ProspectRequests';
import { MyProspectRequests } from './MyProspectRequests';
import { BudgetManagement } from './BudgetManagement';
import { ContactBudgetRequests } from './ContactBudgetRequests';
import { MyBudgetRequests } from './MyBudgetRequests';
import { FileViewer } from './FileViewer';

type Tab = 'mycontacts' | 'search' | 'conflict' | 'add' | 'import' | 'wires' | 'resources' | 'audit' | 'admin' | 'submissions' | 'rewards' | 'meetings' | 'processor-report' | 'weekly-reports' | 'announcements' | 'announcements-admin' | 'employee-communication' | 'sms-management' | 'view-communications' | 'upload-resource' | 'direct-messages' | 'yankees-tickets' | 'prospect-requests' | 'my-prospect-requests' | 'budget-management' | 'budget-requests' | 'my-budget-requests' | 'file-viewer';

export function Dashboard() {
  const { salesPerson, isAdmin, isAdminOrProcessor, signOut, user, refreshSalesPerson, chatEnabled } = useAuth();
  const { isMobile, isTablet } = useDeviceDetection();
  const { hasAccess, loading: permissionsLoading } = useModulePermissions(user?.id, salesPerson?.id || null);
  const dialog = useDialog();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [showLoginAnnouncements, setShowLoginAnnouncements] = useState(false);
  const [showSMSOptIn, setShowSMSOptIn] = useState(false);
  const [unreadCommunicationsCount, setUnreadCommunicationsCount] = useState(0);
  const [unreadDirectMessagesCount, setUnreadDirectMessagesCount] = useState(0);
  const [showMessagesDropdown, setShowMessagesDropdown] = useState(false);
  const [outOfOfficeStatuses, setOutOfOfficeStatuses] = useState<Record<string, { user_id: string; is_enabled: boolean; status_type: string; custom_message: string | null; end_time: string | null }>>({});
  const [myOOOStatus, setMyOOOStatus] = useState<{ is_enabled: boolean; status_type: string; custom_message: string | null; end_time: string | null } | null>(null);
  const [allUsers, setAllUsers] = useState<{ user_id: string; name: string; role: string }[]>([]);
  const [pendingYankeeCount, setPendingYankeeCount] = useState(0);
  const [pendingProspectCount, setPendingProspectCount] = useState(0);
  const [pendingBudgetRequestCount, setPendingBudgetRequestCount] = useState(0);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const messagesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!salesPerson?.budget_display_enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSalesPerson();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(refreshSalesPerson, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [salesPerson?.budget_display_enabled]);

  useEffect(() => {
    if (user && salesPerson) {
      const sessionKey = `announcements_shown_${user.id}`;
      const alreadyShown = sessionStorage.getItem(sessionKey);
      if (!alreadyShown) {
        setShowLoginAnnouncements(true);
        sessionStorage.setItem(sessionKey, 'true');
      }
    }
  }, [user, salesPerson]);

  const fetchUnreadCommunicationsCount = useCallback(async () => {
    if (!user?.id) return;

    const { data: currentUser } = await supabase
      .from('sales_people')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

    let query = supabase
      .from('communication_logs')
      .select('id');

    if (!isAdminUser) {
      query = query.or(`recipient_ids.cs.["${user.id}"],sent_by.eq.${user.id}`);
    }

    const { data: allComms, error: commsError } = await query;

    if (commsError || !allComms) {
      setUnreadCommunicationsCount(0);
      return;
    }

    const { data: readComms } = await supabase
      .from('communication_reads')
      .select('communication_id')
      .eq('user_id', user.id);

    const readIds = new Set(readComms?.map(r => r.communication_id) || []);
    const unreadCount = allComms.filter(c => !readIds.has(c.id)).length;
    setUnreadCommunicationsCount(unreadCount);
  }, [user?.id]);

  const fetchUnreadDirectMessagesCount = useCallback(async () => {
    if (!user?.id) return;

    const { data: participations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!participations?.length) {
      setUnreadDirectMessagesCount(0);
      return;
    }

    const conversationIds = participations.map(p => p.conversation_id);

    const { data: allMessages } = await supabase
      .from('direct_messages')
      .select('id')
      .in('conversation_id', conversationIds)
      .neq('sender_id', user.id);

    if (!allMessages?.length) {
      setUnreadDirectMessagesCount(0);
      return;
    }

    const { data: readMessages } = await supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', user.id);

    const readMessageIds = new Set(readMessages?.map(r => r.message_id) || []);
    const unreadCount = allMessages.filter(m => !readMessageIds.has(m.id)).length;
    setUnreadDirectMessagesCount(unreadCount);
  }, [user?.id]);

  const hasViewCommunications = hasAccess('view_communications');
  const hasDirectMessages = hasAccess('direct_messages');

  useEffect(() => {
    if (user?.id && hasViewCommunications) {
      fetchUnreadCommunicationsCount();
    }
  }, [user?.id, hasViewCommunications, fetchUnreadCommunicationsCount]);

  useEffect(() => {
    if (!user?.id || !hasViewCommunications) return;

    const channel = supabase
      .channel('comm-unread-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communication_logs' }, () => {
        fetchUnreadCommunicationsCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, hasViewCommunications, fetchUnreadCommunicationsCount]);

  useEffect(() => {
    if (user?.id && hasDirectMessages) {
      fetchUnreadDirectMessagesCount();
    }
  }, [user?.id, hasDirectMessages, fetchUnreadDirectMessagesCount]);

  const fetchOutOfOfficeStatuses = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_out_of_office')
      .select('*')
      .eq('is_enabled', true);

    if (!error && data) {
      const statusMap: Record<string, typeof data[0]> = {};
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
      if (user?.id && statusMap[user.id]) {
        setMyOOOStatus(statusMap[user.id]);
      }
    }
  }, [user?.id]);

  const fetchAllUsers = useCallback(async () => {
    const { data } = await supabase
      .from('sales_people')
      .select('user_id, name, role')
      .eq('is_active', true)
      .order('name');
    if (data) {
      setAllUsers(data.filter(u => u.user_id !== user?.id));
    }
  }, [user?.id]);

  const fetchMyOOOStatus = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('user_out_of_office')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setMyOOOStatus(data);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && hasDirectMessages) {
      fetchOutOfOfficeStatuses();
      fetchAllUsers();
      fetchMyOOOStatus();
    }
  }, [user?.id, hasDirectMessages, fetchOutOfOfficeStatuses, fetchAllUsers, fetchMyOOOStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (messagesDropdownRef.current && !messagesDropdownRef.current.contains(event.target as Node)) {
        setShowMessagesDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSuperAdminUser = salesPerson?.role === 'super_admin';

  const fetchPendingYankeeCount = useCallback(async () => {
    if (!isSuperAdminUser) { setPendingYankeeCount(0); return; }
    const { count } = await supabase
      .from('yankees_ticket_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingYankeeCount(count || 0);
  }, [isSuperAdminUser]);

  const fetchPendingProspectCount = useCallback(async () => {
    if (!isSuperAdminUser) { setPendingProspectCount(0); return; }
    const { count } = await supabase
      .from('prospect_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingProspectCount(count || 0);
  }, [isSuperAdminUser]);

  const fetchPendingBudgetRequestCount = useCallback(async () => {
    if (!isSuperAdminUser) { setPendingBudgetRequestCount(0); return; }
    const { count } = await supabase
      .from('contact_budget_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingBudgetRequestCount(count || 0);
  }, [isSuperAdminUser]);

  useEffect(() => {
    if (!isSuperAdminUser) return;
    fetchPendingYankeeCount();
    fetchPendingProspectCount();
    fetchPendingBudgetRequestCount();

    const yankeeChannel = supabase
      .channel('yankee-pending-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yankees_ticket_requests' }, () => {
        fetchPendingYankeeCount();
      })
      .subscribe();

    const prospectChannel = supabase
      .channel('prospect-pending-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospect_requests' }, () => {
        fetchPendingProspectCount();
      })
      .subscribe();

    const budgetRequestChannel = supabase
      .channel('budget-request-pending-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_budget_requests' }, () => {
        fetchPendingBudgetRequestCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(yankeeChannel);
      supabase.removeChannel(prospectChannel);
      supabase.removeChannel(budgetRequestChannel);
    };
  }, [isSuperAdminUser, fetchPendingYankeeCount, fetchPendingProspectCount, fetchPendingBudgetRequestCount]);

  const getOOOStatusInfo = (statusType: string) => {
    const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
      lunch: { icon: Coffee, label: 'At Lunch', color: 'bg-amber-100 text-amber-800' },
      out_of_office: { icon: Briefcase, label: 'Out of Office', color: 'bg-blue-100 text-blue-800' },
      meeting: { icon: Calendar, label: 'In a Meeting', color: 'bg-emerald-100 text-emerald-800' },
      vacation: { icon: Palmtree, label: 'On Vacation', color: 'bg-teal-100 text-teal-800' },
      custom: { icon: Clock, label: 'Away', color: 'bg-slate-100 text-slate-800' }
    };
    return statusConfig[statusType] || statusConfig.custom;
  };

  const oooUsers = allUsers.filter(u => outOfOfficeStatuses[u.user_id]);
  const oooCount = oooUsers.length;

  const roleColors: Record<string, string> = {
    super_admin: 'from-purple-500 to-purple-600',
    admin: 'from-amber-500 to-amber-600',
    salesperson: 'from-blue-500 to-blue-600',
    closer: 'from-emerald-500 to-emerald-600',
    processor: 'from-teal-500 to-teal-600',
    sales_processor: 'from-cyan-500 to-cyan-600'
  };

  const getGreeting = () => {
    const hour = nowInEST().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getCurrentDate = () => {
    const date = nowInEST();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  };

  // Regular user-facing tabs
  const allRegularTabs = [
    { id: 'search' as Tab, label: 'Search Contacts', icon: SearchIcon, module: 'contact_search', color: 'text-blue-600' },
    { id: 'mycontacts' as Tab, label: 'My Contacts', icon: Users, module: 'my_contacts', color: 'text-emerald-600' },
    { id: 'conflict' as Tab, label: 'Conflict Check', icon: AlertCircle, module: 'conflict_check', color: 'text-amber-600' },
    { id: 'wires' as Tab, label: 'Wire Management', icon: FileCheck, module: 'verify_wires', color: 'text-teal-600' },
    { id: 'submissions' as Tab, label: 'Submit Rewards', icon: Award, module: 'closer_submissions', color: 'text-yellow-600' },
    { id: 'processor-report' as Tab, label: 'Submit Performance Report', icon: ClipboardList, module: 'submit_performance_report', color: 'text-blue-700' },
    { id: 'meetings' as Tab, label: 'Meeting Logs', icon: Calendar, module: 'meeting_logs_report', color: 'text-orange-600' },
    { id: 'resources' as Tab, label: 'Resources', icon: FileText, module: 'resources', color: 'text-slate-600' },
    { id: 'direct-messages' as Tab, label: 'Direct Messages', icon: MessageCircle, module: 'direct_messages', color: 'text-blue-600' },
    { id: 'yankees-tickets' as Tab, label: 'Yankees Tickets', icon: Ticket, module: 'yankees_tickets', color: 'text-slate-700' },
    { id: 'my-prospect-requests' as Tab, label: 'My Prospect Requests', icon: UserPlus, module: 'my_prospect_requests', color: 'text-cyan-600' },
    { id: 'my-budget-requests' as Tab, label: 'My Friends and Family', icon: DollarSign, module: 'my_budget_requests', color: 'text-emerald-600' },
    { id: 'file-viewer' as Tab, label: 'File Viewer', icon: FileSearch, module: 'file_viewer', color: 'text-blue-600' },
  ];

  // Administrative tabs that will be in the dropdown
  const allAdminTabs = [
    { id: 'add' as Tab, label: 'Add Prospect', icon: UserPlus, module: 'add_prospect', color: 'text-cyan-600' },
    { id: 'admin' as Tab, label: 'Admin Panel', icon: Database, module: 'admin_panel', color: 'text-rose-600' },
    { id: 'audit' as Tab, label: 'Audit Log', icon: History, module: 'audit_log', color: 'text-slate-500' },
    { id: 'announcements-admin' as Tab, label: 'Manage Announcements', icon: Megaphone, module: 'manage_announcements', color: 'text-teal-600' },
    { id: 'employee-communication' as Tab, label: 'Manage Office Communications', icon: Mail, module: 'employee_communication', color: 'text-purple-600' },
    { id: 'sms-management' as Tab, label: 'SMS Opt-In Management', icon: MessageSquare, module: 'sms_management', color: 'text-blue-600' },
    { id: 'rewards' as Tab, label: 'Rewards Report', icon: Award, module: 'closer_rewards_report', color: 'text-yellow-600' },
    { id: 'weekly-reports' as Tab, label: 'View Performance Reports', icon: ClipboardList, module: 'weekly_reports', color: 'text-blue-700' },
    { id: 'upload-resource' as Tab, label: 'Upload Resource', icon: Upload, module: 'upload_resource', color: 'text-rose-600' },
    { id: 'import' as Tab, label: 'Batch Import Contact Data', icon: Upload, module: 'import_data', color: 'text-violet-600' },
    { id: 'prospect-requests' as Tab, label: 'Prospect Requests', icon: UserPlus, module: 'prospect_requests', color: 'text-cyan-600' },
    { id: 'budget-requests' as Tab, label: 'Friends and Family', icon: DollarSign, module: 'budget_requests', color: 'text-emerald-600' },
    { id: 'budget-management' as Tab, label: 'Budget Management', icon: DollarSign, module: 'budget_edit', color: 'text-emerald-600' },
  ];

  const regularTabs = permissionsLoading ? [] : allRegularTabs.filter(tab => {
    if (tab.id === 'wires') {
      return hasAccess('verify_wires') || hasAccess('incoming_wires');
    }
    if (tab.id === 'my-budget-requests') {
      return salesPerson?.friends_family_enabled && hasAccess(tab.module);
    }
    if (tab.id === 'file-viewer') {
      return salesPerson?.file_viewer_enabled;
    }
    return hasAccess(tab.module);
  });
  const adminTabs = permissionsLoading ? [] : allAdminTabs.filter(tab => hasAccess(tab.module));

  const [activeTab, setActiveTab] = useState<Tab>('search');

  useEffect(() => {
    if (activeTab === 'view-communications') {
      const timer = setTimeout(() => {
        fetchUnreadCommunicationsCount();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchUnreadCommunicationsCount]);

  useEffect(() => {
    if (activeTab === 'direct-messages') {
      const timer = setTimeout(() => {
        fetchUnreadDirectMessagesCount();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchUnreadDirectMessagesCount]);

  const isCloser = salesPerson?.role === 'closer';
  const isSuperAdmin = salesPerson?.role === 'super_admin';

  // Close admin dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setShowAdminDropdown(false);
      }
    };

    if (showAdminDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdminDropdown]);

  useEffect(() => {
    if (!permissionsLoading) {
      const allTabs = [...regularTabs, ...adminTabs];
      if (allTabs.length > 0) {
        // Check if current tab has access (including standalone tabs like announcements and view-communications)
        const currentTabHasAccess = allTabs.some(tab => tab.id === activeTab) ||
          (activeTab === 'announcements' && hasAccess('announcements')) ||
          (activeTab === 'view-communications' && hasAccess('view_communications'));
        if (!currentTabHasAccess) {
          setActiveTab(allTabs[0].id);
        }
      }
    }
  }, [permissionsLoading, regularTabs, adminTabs, activeTab, hasAccess]);

  const handlePasswordUpdate = async () => {
    setPasswordError(null);

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      await dialog.alert('Password updated successfully!');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className={`max-w-7xl mx-auto ${isMobile ? 'px-3 py-3' : 'px-6 lg:px-8 py-4'}`}>
          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
            <div className={`${isMobile ? 'w-full' : 'min-w-0 flex-1'}`}>
              <div className={`flex ${isMobile ? 'flex-col' : 'flex-row items-center'} gap-4`}>
                <img
                  src="/Copy_of_Copy_of_Evident_Logo_26_(3).png"
                  alt="Evident Title Agency Logo"
                  className={`${isMobile ? 'h-16' : 'h-20'} object-contain border-2 border-slate-300 rounded-lg p-2 cursor-pointer`}
                  onClick={() => setActiveTab('search')}
                />
                <div className={`flex flex-col gap-1 ${isMobile ? 'mt-0' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-slate-600 whitespace-nowrap ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {getGreeting()}, <span className="font-semibold">{salesPerson?.name}</span>
                    </p>
                  {isAdmin && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${
                      salesPerson?.role === 'super_admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      <Shield className="w-3 h-3" />
                      {salesPerson?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </span>
                  )}
                </div>
                  <p className={`text-slate-500 whitespace-nowrap ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {getCurrentDate()}
                  </p>
                  {salesPerson?.budget_display_enabled && (
                    <p className={`text-slate-600 font-medium flex items-center gap-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Budget: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(salesPerson.budget ?? 0)}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className={`flex flex-shrink-0 ${isMobile ? 'flex-row gap-2 w-full justify-start' : 'flex-col gap-2 items-start ml-2'}`}>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Announcements onNavigateToAnnouncements={() => setActiveTab('announcements')} />
                </div>
                {chatEnabled && hasAccess('direct_messages') && (
                  <div className="relative" ref={messagesDropdownRef}>
                    <button
                      onClick={() => setShowMessagesDropdown(!showMessagesDropdown)}
                      className={`relative flex items-center text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors ${
                        isMobile ? 'gap-1 px-2 py-2' : 'gap-2 px-3 py-2'
                      } ${myOOOStatus?.is_enabled ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                    >
                      <MessageCircle className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
                      <span className={isMobile ? 'text-xs' : 'text-sm'}>Messages / Set Out of Office</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showMessagesDropdown ? 'rotate-180' : ''}`} />
                      {(unreadDirectMessagesCount > 0 || oooCount > 0) && (
                        <span className="absolute -top-2 -right-2 flex items-center gap-0.5">
                          {unreadDirectMessagesCount > 0 && (
                            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                              {unreadDirectMessagesCount > 99 ? '99+' : unreadDirectMessagesCount}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                    {showMessagesDropdown && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-slate-50">
                          <button
                            onClick={() => {
                              setActiveTab('direct-messages');
                              setShowMessagesDropdown(false);
                            }}
                            className="w-full flex items-center justify-between p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <MessageCircle className="w-5 h-5" />
                              <span className="font-medium">Open Messages</span>
                            </div>
                            {unreadDirectMessagesCount > 0 && (
                              <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm font-bold">
                                {unreadDirectMessagesCount} unread
                              </span>
                            )}
                          </button>
                        </div>
                        <div className="p-3 border-b border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-700">Your Status</span>
                            {myOOOStatus?.is_enabled && (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getOOOStatusInfo(myOOOStatus.status_type).color}`}>
                                {getOOOStatusInfo(myOOOStatus.status_type).label}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setActiveTab('direct-messages');
                              setShowMessagesDropdown(false);
                            }}
                            className={`w-full flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${
                              myOOOStatus?.is_enabled
                                ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {myOOOStatus?.is_enabled ? 'Manage Your Status' : 'Set Out of Office'}
                            </span>
                          </button>
                        </div>
                        {oooCount > 0 && (
                          <div className="p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                              <span className="text-sm font-semibold text-slate-700">Who's Away</span>
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                                {oooCount}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {oooUsers.map(u => {
                                const status = outOfOfficeStatuses[u.user_id];
                                const statusInfo = getOOOStatusInfo(status.status_type);
                                const StatusIcon = statusInfo.icon;
                                return (
                                  <div
                                    key={u.user_id}
                                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg"
                                  >
                                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleColors[u.role] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                                      {u.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-medium text-slate-900 truncate">{u.name}</span>
                                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex items-center gap-0.5 ${statusInfo.color}`}>
                                          <StatusIcon className="w-2.5 h-2.5" />
                                          {statusInfo.label}
                                        </span>
                                      </div>
                                      {status.end_time && (
                                        <p className="text-[10px] text-slate-500">
                                          Back: {new Date(status.end_time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {oooCount === 0 && (
                          <div className="p-4 text-center text-slate-500 text-sm">
                            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            Everyone is available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {hasAccess('view_communications') && (
                  <button
                    onClick={() => setActiveTab('view-communications')}
                    className={`relative flex items-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors ${
                      isMobile ? 'gap-1 px-2 py-2' : 'gap-2 px-4 py-2'
                    }`}
                  >
                    <Mail className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
                    <span className={isMobile ? 'text-xs' : 'text-sm'}>Office Communications</span>
                    {unreadCommunicationsCount > 0 && (
                      <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                        {unreadCommunicationsCount > 99 ? '99+' : unreadCommunicationsCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
              {!isMobile && !isTablet && (
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Key className="w-5 h-5" />
                  <span className="text-sm">Update Password</span>
                </button>
              )}
              <button
                onClick={() => signOut()}
                className={`flex items-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors ${
                  isMobile ? 'gap-1 px-2 py-2' : 'gap-2 px-4 py-2'
                }`}
              >
                <LogOut className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
                <span className={isMobile ? 'text-xs' : 'text-sm'}>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className={`max-w-7xl mx-auto ${isMobile ? 'px-2 py-2' : 'px-6 lg:px-8 py-3'}`}>
          <div className="flex flex-wrap gap-2 items-start">
            {adminTabs.length > 0 && (
              <div className="relative" ref={adminDropdownRef}>
                <button
                  onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                  className={`flex items-center font-medium whitespace-nowrap transition-all rounded-lg border ${
                    isMobile ? 'gap-1 px-2.5 py-2 text-xs' : 'gap-2 px-3.5 py-2.5 text-sm'
                  } ${
                    adminTabs.some(tab => tab.id === activeTab)
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-1 ring-rose-300'
                      : 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700 hover:border-rose-700 shadow-sm hover:shadow-md'
                  }`}
                >
                  <Shield className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                  <span>{isMobile ? 'Admin' : 'Administration'}</span>
                  <ChevronDown className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} transition-transform ${showAdminDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showAdminDropdown && (
                  <div className={`absolute top-full mt-2 bg-white rounded-lg shadow-2xl border-2 border-rose-200 overflow-hidden z-20 ${
                    isMobile ? 'min-w-[220px]' : 'min-w-[280px]'
                  }`}>
                    <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-2.5 border-b-2 border-rose-700">
                      <p className="text-white font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Administrative Tools
                      </p>
                    </div>
                    {adminTabs.map((tab) => {
                      const Icon = tab.icon;
                      const adminBadge = tab.id === 'prospect-requests' ? pendingProspectCount : tab.id === 'budget-requests' ? pendingBudgetRequestCount : 0;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setActiveTab(tab.id);
                            setShowAdminDropdown(false);
                          }}
                          className={`w-full flex items-center font-semibold transition-all border-b border-slate-100 last:border-b-0 ${
                            isMobile ? 'gap-2.5 px-4 py-3 text-xs' : 'gap-3 px-5 py-3.5 text-sm'
                          } ${
                            activeTab === tab.id
                              ? 'bg-rose-50 text-rose-900 border-l-4 border-l-rose-600'
                              : 'text-slate-700 hover:bg-rose-50 hover:text-rose-900 hover:border-l-4 hover:border-l-rose-400'
                          }`}
                        >
                          <Icon className={`${isMobile ? 'w-5 h-5' : 'w-5 h-5'} ${activeTab === tab.id ? 'text-rose-600' : tab.color}`} />
                          <span className="text-left flex-1">{tab.label}</span>
                          {adminBadge > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center">
                              {adminBadge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {hasAccess('announcements') && (
              <button
                onClick={() => setActiveTab('announcements')}
                title="Announcements"
                className={`flex items-center font-medium whitespace-nowrap transition-all rounded-lg border ${
                  isMobile ? 'gap-1 px-2.5 py-2 text-xs' : 'gap-2 px-3.5 py-2.5 text-sm'
                } ${
                  activeTab === 'announcements'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-lg ring-2 ring-teal-300'
                    : 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700 hover:border-teal-700 shadow-sm hover:shadow-md'
                }`}
              >
                <Megaphone className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                <span>{isMobile ? 'News' : 'Announcements'}</span>
              </button>
            )}

            {adminTabs.length > 0 && regularTabs.length > 0 && (
              <div className={`${isMobile ? 'w-px h-10' : 'w-px h-12'} bg-slate-300 mx-1`}></div>
            )}

            {regularTabs.map((tab) => {
              const Icon = tab.icon;
              const mobileLabel = tab.label.split(' ')[0];
              const badgeCount = tab.id === 'yankees-tickets' ? pendingYankeeCount
                : tab.id === 'my-prospect-requests' ? pendingProspectCount
                : 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`relative flex items-center font-medium whitespace-nowrap transition-all rounded-lg border ${
                    isMobile ? 'gap-1 px-2.5 py-2 text-xs' : 'gap-2 px-4 py-2.5 text-sm'
                  } ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:shadow-sm hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} ${activeTab === tab.id ? 'text-white' : tab.color}`} />
                  <span className={isMobile ? 'text-xs' : ''}>{isMobile ? mobileLabel : tab.label}</span>
                  {badgeCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className={`max-w-7xl mx-auto ${isMobile ? 'px-3 py-4' : 'px-6 lg:px-8 py-8'}`}>
        {activeTab === 'mycontacts' && hasAccess('my_contacts') && <MyContacts onNavigateToBudgetRequests={salesPerson?.friends_family_enabled ? () => setActiveTab('my-budget-requests') : undefined} />}
        {activeTab === 'search' && hasAccess('contact_search') && <ContactSearch />}
        {activeTab === 'conflict' && hasAccess('conflict_check') && <ConflictCheck />}
        {activeTab === 'add' && hasAccess('add_prospect') && <AddProspect />}
        {activeTab === 'import' && hasAccess('import_data') && <ImportData />}
        {activeTab === 'wires' && (hasAccess('verify_wires') || hasAccess('incoming_wires')) && <WireManagement />}
        {activeTab === 'processor-report' && hasAccess('submit_performance_report') && <ProcessorReportForm />}
        {activeTab === 'resources' && hasAccess('resources') && <Resources />}
        {activeTab === 'submissions' && hasAccess('closer_submissions') && <CloserSubmissions />}
        {activeTab === 'rewards' && hasAccess('closer_rewards_report') && <CloserRewardsReport />}
        {activeTab === 'weekly-reports' && hasAccess('weekly_reports') && <WeeklyReportsView />}
        {activeTab === 'meetings' && hasAccess('meeting_logs_report') && <MeetingLogsReport />}
        {activeTab === 'announcements' && hasAccess('announcements') && <AnnouncementsArchive />}
        {activeTab === 'announcements-admin' && hasAccess('manage_announcements') && <AnnouncementsAdmin />}
        {activeTab === 'view-communications' && hasAccess('view_communications') && <ViewCommunications />}
        {activeTab === 'employee-communication' && hasAccess('employee_communication') && <EmployeeCommunication />}
        {activeTab === 'sms-management' && hasAccess('sms_management') && <SMSOptInManagement />}
        {activeTab === 'upload-resource' && hasAccess('upload_resource') && <UploadResource />}
        {activeTab === 'direct-messages' && chatEnabled && hasAccess('direct_messages') && <DirectMessages />}
        {activeTab === 'audit' && hasAccess('audit_log') && <AuditLog />}
        {activeTab === 'admin' && hasAccess('admin_panel') && <AdminPanel />}
        {activeTab === 'yankees-tickets' && <YankeesTickets />}
        {activeTab === 'prospect-requests' && hasAccess('prospect_requests') && <ProspectRequests />}
        {activeTab === 'my-prospect-requests' && hasAccess('my_prospect_requests') && <MyProspectRequests />}
        {activeTab === 'budget-management' && hasAccess('budget_edit') && <BudgetManagement />}
        {activeTab === 'budget-requests' && hasAccess('budget_requests') && <ContactBudgetRequests />}
        {activeTab === 'my-budget-requests' && salesPerson?.friends_family_enabled && hasAccess('my_budget_requests') && <MyBudgetRequests />}
        {activeTab === 'file-viewer' && salesPerson?.file_viewer_enabled && <FileViewer />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <button
              onClick={() => setShowSMSOptIn(true)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              SMS Opt-In
            </button>
          </div>
        </div>
      </footer>

      {showSMSOptIn && (
        <SMSOptInModal
          isOpen={showSMSOptIn}
          onClose={() => setShowSMSOptIn(false)}
        />
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Update Password</h2>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm new password"
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{passwordError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePasswordUpdate}
                  disabled={passwordLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordError(null);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {showLoginAnnouncements && (
        <LoginAnnouncementsModal onClose={() => setShowLoginAnnouncements(false)} />
      )}
    </div>
  );
}
