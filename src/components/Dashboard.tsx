import { useState } from 'react';
import { LogOut, Search as SearchIcon, UserPlus, History, Upload, Shield, Database, Users, FileCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ContactSearch } from './ContactSearch';
import { AddProspect } from './AddProspect';
import { AuditLog } from './AuditLog';
import { ImportData } from './ImportData';
import { AdminPanel } from './AdminPanel';
import { MyContacts } from './MyContacts';
import { VerifyWires } from './VerifyWires';
import { ConflictCheck } from './ConflictCheck';

type Tab = 'mycontacts' | 'search' | 'conflict' | 'add' | 'import' | 'verify' | 'audit' | 'admin';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('mycontacts');
  const { salesPerson, isAdmin, isAdminOrProcessor, signOut } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const commonTabs = [
    { id: 'mycontacts' as Tab, label: 'My Contacts', icon: Users },
    { id: 'conflict' as Tab, label: 'Conflict Check', icon: AlertCircle },
  ];

  const salespersonTabs = [
    ...commonTabs,
    { id: 'import' as Tab, label: 'Import Data', icon: Upload },
  ];

  const processorTabs = [
    ...commonTabs,
    { id: 'search' as Tab, label: 'Search', icon: SearchIcon },
    { id: 'import' as Tab, label: 'Import Data', icon: Upload },
    { id: 'verify' as Tab, label: 'Verify Wires', icon: FileCheck },
  ];

  const adminOnlyTabs = [
    { id: 'add' as Tab, label: 'Add Prospect', icon: UserPlus },
    { id: 'audit' as Tab, label: 'Audit Log', icon: History },
    { id: 'admin' as Tab, label: 'Admin Panel', icon: Database },
  ];

  const tabs = isAdmin
    ? [...processorTabs, ...adminOnlyTabs]
    : isAdminOrProcessor
    ? processorTabs
    : salespersonTabs;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Evident Edge</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-600">
                  {getGreeting()}, <span className="font-semibold">{salesPerson?.name}</span>
                </p>
                {isAdmin && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                    salesPerson?.role === 'super_admin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    <Shield className="w-3 h-3" />
                    {salesPerson?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'mycontacts' && <MyContacts />}
        {activeTab === 'search' && isAdminOrProcessor && <ContactSearch />}
        {activeTab === 'conflict' && <ConflictCheck />}
        {activeTab === 'add' && isAdmin && <AddProspect />}
        {activeTab === 'import' && <ImportData />}
        {activeTab === 'verify' && isAdminOrProcessor && <VerifyWires />}
        {activeTab === 'audit' && isAdmin && <AuditLog />}
        {activeTab === 'admin' && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
}
