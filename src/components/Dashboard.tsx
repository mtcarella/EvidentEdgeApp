import { useState, useEffect } from 'react';
import { LogOut, Search as SearchIcon, UserPlus, History, Upload, Shield, Database, Users, FileCheck, AlertCircle, FileText, Key, Award, DollarSign, Calendar, ClipboardList } from 'lucide-react';
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
import { VerifyWires } from './VerifyWires';
import { ConflictCheck } from './ConflictCheck';
import { Resources } from './Resources';
import { IncomingWires } from './IncomingWires';
import CloserSubmissions from './CloserSubmissions';
import CloserRewardsReport from './CloserRewardsReport';
import { MeetingLogsReport } from './MeetingLogsReport';
import ProcessorReportForm from './ProcessorReportForm';
import WeeklyReportsView from './WeeklyReportsView';
import { BirthdayBanner } from './BirthdayBanner';

type Tab = 'mycontacts' | 'search' | 'conflict' | 'add' | 'import' | 'verify' | 'resources' | 'audit' | 'admin' | 'submissions' | 'rewards' | 'incoming' | 'meetings' | 'processor-report' | 'weekly-reports';

export function Dashboard() {
  const { salesPerson, isAdmin, isAdminOrProcessor, signOut, user } = useAuth();
  const { isMobile, isTablet } = useDeviceDetection();
  const { hasAccess, loading: permissionsLoading } = useModulePermissions(user?.id, salesPerson?.id || null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

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

  const allPossibleTabs = [
    { id: 'search' as Tab, label: 'Search Contacts', icon: SearchIcon, module: 'contact_search', color: 'text-blue-600' },
    { id: 'mycontacts' as Tab, label: 'My Contacts', icon: Users, module: 'my_contacts', color: 'text-emerald-600' },
    { id: 'conflict' as Tab, label: 'Conflict Check', icon: AlertCircle, module: 'conflict_check', color: 'text-amber-600' },
    { id: 'add' as Tab, label: 'Add Prospect', icon: UserPlus, module: 'add_prospect', color: 'text-cyan-600' },
    { id: 'import' as Tab, label: 'Batch Import Contact Data', icon: Upload, module: 'import_data', color: 'text-violet-600' },
    { id: 'verify' as Tab, label: 'Verify Wires', icon: FileCheck, module: 'verify_wires', color: 'text-teal-600' },
    { id: 'incoming' as Tab, label: 'Incoming Wires', icon: DollarSign, module: 'incoming_wires', color: 'text-green-600' },
    { id: 'submissions' as Tab, label: 'Submit Rewards', icon: Award, module: 'closer_submissions', color: 'text-yellow-600' },
    { id: 'rewards' as Tab, label: 'Rewards Report', icon: Award, module: 'closer_rewards_report', color: 'text-yellow-600' },
    { id: 'processor-report' as Tab, label: 'Submit Performance Report', icon: ClipboardList, module: 'submit_performance_report', color: 'text-blue-700' },
    { id: 'weekly-reports' as Tab, label: 'View Performance Reports', icon: ClipboardList, module: 'weekly_reports', color: 'text-blue-700' },
    { id: 'meetings' as Tab, label: 'Meeting Logs', icon: Calendar, module: 'meeting_logs_report', color: 'text-orange-600' },
    { id: 'resources' as Tab, label: 'Resources', icon: FileText, module: 'resources', color: 'text-slate-600' },
    { id: 'audit' as Tab, label: 'Audit Log', icon: History, module: 'audit_log', color: 'text-slate-500' },
    { id: 'admin' as Tab, label: 'Admin Panel', icon: Database, module: 'admin_panel', color: 'text-rose-600' },
  ];

  const tabs = permissionsLoading ? [] : allPossibleTabs.filter(tab => hasAccess(tab.module));

  const [activeTab, setActiveTab] = useState<Tab>('search');

  const isCloser = salesPerson?.role === 'closer';
  const isSuperAdmin = salesPerson?.role === 'super_admin';

  useEffect(() => {
    if (!permissionsLoading && tabs.length > 0) {
      const currentTabHasAccess = tabs.some(tab => tab.id === activeTab);
      if (!currentTabHasAccess) {
        setActiveTab(tabs[0].id);
      }
    }
  }, [permissionsLoading, tabs, activeTab]);

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
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className={`font-bold text-black bg-blue-400 px-4 py-2 rounded-lg inline-block ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                Evident Edge
              </h1>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-slate-600 truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>
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
                <p className={`text-slate-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  {getCurrentDate()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <button
                onClick={() => setShowPasswordModal(true)}
                className={`flex items-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors ${
                  isMobile ? 'gap-1 px-2 py-2' : 'gap-2 px-4 py-2'
                }`}
              >
                <Key className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
                {!isMobile && <span className="text-sm">Update Password</span>}
              </button>
              <button
                onClick={() => signOut()}
                className={`flex items-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors ${
                  isMobile ? 'gap-1 px-2 py-2' : 'gap-2 px-4 py-2'
                }`}
              >
                <LogOut className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
                {!isMobile && <span className="text-sm">Sign Out</span>}
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className={`max-w-7xl mx-auto ${isMobile ? 'px-2 py-2' : 'px-6 lg:px-8 py-3'}`}>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
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

      <BirthdayBanner />

      <main className={`max-w-7xl mx-auto ${isMobile ? 'px-3 py-4' : 'px-6 lg:px-8 py-8'}`}>
        {activeTab === 'mycontacts' && hasAccess('my_contacts') && <MyContacts />}
        {activeTab === 'search' && hasAccess('contact_search') && <ContactSearch />}
        {activeTab === 'conflict' && hasAccess('conflict_check') && <ConflictCheck />}
        {activeTab === 'add' && hasAccess('add_prospect') && <AddProspect />}
        {activeTab === 'import' && hasAccess('import_data') && <ImportData />}
        {activeTab === 'verify' && hasAccess('verify_wires') && <VerifyWires />}
        {activeTab === 'incoming' && hasAccess('incoming_wires') && <IncomingWires />}
        {activeTab === 'processor-report' && hasAccess('submit_performance_report') && <ProcessorReportForm />}
        {activeTab === 'resources' && hasAccess('resources') && <Resources />}
        {activeTab === 'submissions' && hasAccess('closer_submissions') && <CloserSubmissions />}
        {activeTab === 'rewards' && hasAccess('closer_rewards_report') && <CloserRewardsReport />}
        {activeTab === 'weekly-reports' && hasAccess('weekly_reports') && <WeeklyReportsView />}
        {activeTab === 'meetings' && hasAccess('meeting_logs_report') && <MeetingLogsReport />}
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
    </div>
  );
}
