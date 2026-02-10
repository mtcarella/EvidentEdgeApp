import { useState, useEffect, useRef } from 'react';
import { LogOut, Search as SearchIcon, UserPlus, History, Upload, Shield, Database, Users, FileCheck, AlertCircle, FileText, Key, Award, DollarSign, Calendar, ClipboardList, ChevronDown, Settings, Mail, Bell, Megaphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
import ContactExecutive from './ContactExecutive';
import { Announcements } from './Announcements';
import { AnnouncementsArchive } from './AnnouncementsArchive';
import { AnnouncementsAdmin } from './AnnouncementsAdmin';

type Tab = 'mycontacts' | 'search' | 'conflict' | 'add' | 'import' | 'wires' | 'resources' | 'audit' | 'admin' | 'submissions' | 'rewards' | 'meetings' | 'processor-report' | 'weekly-reports' | 'announcements' | 'announcements-admin';

export function Dashboard() {
  const { salesPerson, isAdmin, isAdminOrProcessor, signOut, user } = useAuth();
  const { isMobile, isTablet } = useDeviceDetection();
  const { hasAccess, loading: permissionsLoading } = useModulePermissions(user?.id, salesPerson?.id || null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [showContactExecutive, setShowContactExecutive] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);

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
    { id: 'audit' as Tab, label: 'Audit Log', icon: History, module: 'audit_log', color: 'text-slate-500' },
  ];

  // Administrative tabs that will be in the dropdown
  const allAdminTabs = [
    { id: 'add' as Tab, label: 'Add Prospect', icon: UserPlus, module: 'add_prospect', color: 'text-cyan-600' },
    { id: 'admin' as Tab, label: 'Admin Panel', icon: Database, module: 'admin_panel', color: 'text-rose-600' },
    { id: 'announcements-admin' as Tab, label: 'Manage Announcements', icon: Megaphone, module: 'manage_announcements', color: 'text-teal-600' },
    { id: 'rewards' as Tab, label: 'Rewards Report', icon: Award, module: 'closer_rewards_report', color: 'text-yellow-600' },
    { id: 'weekly-reports' as Tab, label: 'View Performance Reports', icon: ClipboardList, module: 'weekly_reports', color: 'text-blue-700' },
    { id: 'import' as Tab, label: 'Batch Import Contact Data', icon: Upload, module: 'import_data', color: 'text-violet-600' },
  ];

  const regularTabs = permissionsLoading ? [] : allRegularTabs.filter(tab => {
    if (tab.id === 'wires') {
      return hasAccess('verify_wires') || hasAccess('incoming_wires');
    }
    return hasAccess(tab.module);
  });
  const adminTabs = permissionsLoading ? [] : allAdminTabs.filter(tab => hasAccess(tab.module));

  const [activeTab, setActiveTab] = useState<Tab>('search');

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
        // Check if current tab has access (including standalone tabs like announcements)
        const currentTabHasAccess = allTabs.some(tab => tab.id === activeTab) ||
          (activeTab === 'announcements' && hasAccess('announcements'));
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

      alert('Password updated successfully!');
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
                  className={`${isMobile ? 'h-16' : 'h-20'} object-contain border-2 border-slate-300 rounded-lg p-2`}
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
                </div>
              </div>
            </div>
            <div className={`flex flex-shrink-0 ${isMobile ? 'flex-row gap-2 w-full justify-start' : 'flex-col gap-2 items-start ml-2'}`}>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Announcements onNavigateToAnnouncements={() => setActiveTab('announcements')} />
                </div>
                <button
                  onClick={() => setShowContactExecutive(true)}
                  className={`flex items-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors ${
                    isMobile ? 'gap-1 px-2 py-2' : 'gap-2 px-4 py-2'
                  }`}
                >
                  <Mail className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
                  <span className={isMobile ? 'text-xs' : 'text-sm'}>Contact Executives</span>
                </button>
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
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`flex items-center font-medium whitespace-nowrap transition-all rounded-lg border ${
                    isMobile ? 'gap-1 px-2.5 py-2 text-xs' : 'gap-2 px-4 py-2.5 text-sm'
                  } ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:shadow-sm hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} ${activeTab === tab.id ? 'text-white' : tab.color}`} />
                  <span className={isMobile ? 'text-xs' : ''}>{isMobile ? mobileLabel : tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className={`max-w-7xl mx-auto ${isMobile ? 'px-3 py-4' : 'px-6 lg:px-8 py-8'}`}>
        {activeTab === 'mycontacts' && hasAccess('my_contacts') && <MyContacts />}
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
        {activeTab === 'audit' && hasAccess('audit_log') && <AuditLog />}
        {activeTab === 'admin' && hasAccess('admin_panel') && <AdminPanel />}
      </main>

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

      <ContactExecutive
        isOpen={showContactExecutive}
        onClose={() => setShowContactExecutive(false)}
      />
    </div>
  );
}
