import { useState, useEffect } from 'react';
import { Shield, RefreshCw, Save, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SalesPerson {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface ModulePermission {
  user_id: string;
  module_name: string;
  has_access: boolean;
}

interface ModuleDefinition {
  name: string;
  label: string;
  description: string;
  special?: boolean;
}

const AVAILABLE_MODULES: ModuleDefinition[] = [
  { name: 'dashboard', label: 'Dashboard', description: 'Main dashboard view' },
  { name: 'add_prospect', label: 'Add Prospect', description: 'Add new prospects' },
  { name: 'my_contacts', label: 'My Contacts', description: 'View own contacts' },
  { name: 'contact_search', label: 'Contact Search', description: 'Search all contacts' },
  { name: 'incoming_wires', label: 'Incoming Wires', description: 'View incoming wires' },
  { name: 'verify_wires', label: 'Verify Wires', description: 'Verify wire transactions' },
  { name: 'closer_submissions', label: 'Submit Rewards', description: 'Submit rewards for closings' },
  { name: 'closer_rewards_report', label: 'Closer Rewards Report', description: 'View rewards report' },
  { name: 'submit_performance_report', label: 'Submit Performance Report', description: 'Submit performance reports' },
  { name: 'weekly_reports', label: 'View Performance Reports', description: 'View performance reports' },
  { name: 'view_daily_reports', label: 'View Daily Reports', description: 'View daily performance reports' },
  { name: 'meeting_logs_report', label: 'Meeting Logs Report', description: 'View meeting logs' },
  { name: 'admin_panel', label: 'Admin Panel', description: 'Database management' },
  { name: 'audit_log', label: 'Audit Log', description: 'View audit logs' },
  { name: 'import_data', label: 'Import Data', description: 'Import contact data' },
  { name: 'resources', label: 'Resources', description: 'View company resources' },
  { name: 'conflict_check', label: 'Conflict Check', description: 'Check for conflicts' },
  { name: 'manage_announcements', label: 'Manage Announcements', description: 'Create and manage announcements' },
  { name: 'employee_communication', label: 'Office Communication', description: 'Send emails and texts to employees' },
  { name: 'yankees_tickets', label: 'Yankees Tickets', description: 'View and request Yankees game tickets' },
  { name: 'edit_admin_fields', label: 'Edit Admin Fields', description: 'Edit assignment, paralegal, preferred vendors, and processor notes', special: true },
];

export function ModulePermissionsManager() {
  const { salesPersonId } = useAuth();
  const [users, setUsers] = useState<SalesPerson[]>([]);
  const [permissions, setPermissions] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadPermissions(selectedUser);
    }
  }, [selectedUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_people')
        .select('id, name, email, role, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_module_permissions')
        .select('module_name, has_access')
        .eq('user_id', userId);

      if (error) throw error;

      const userPermissions = new Set<string>();
      data?.forEach((perm) => {
        if (perm.has_access) {
          userPermissions.add(perm.module_name);
        }
      });

      setPermissions(new Map(permissions.set(userId, userPermissions)));
    } catch (error) {
      console.error('Error loading permissions:', error);
      alert('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (userId: string, moduleName: string) => {
    const userPerms = permissions.get(userId) || new Set<string>();
    const newPerms = new Set(userPerms);

    if (newPerms.has(moduleName)) {
      newPerms.delete(moduleName);
    } else {
      newPerms.add(moduleName);
    }

    setPermissions(new Map(permissions.set(userId, newPerms)));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const userPerms = permissions.get(selectedUser) || new Set<string>();

      for (const module of AVAILABLE_MODULES) {
        const hasAccess = userPerms.has(module.name);

        const { error } = await supabase
          .from('user_module_permissions')
          .upsert({
            user_id: selectedUser,
            module_name: module.name,
            has_access: hasAccess,
            granted_by: salesPersonId,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,module_name'
          });

        if (error) {
          console.error('Error saving permission for module:', module.name, error);
          throw new Error(`Failed to save ${module.label}: ${error.message}`);
        }
      }

      alert('Permissions saved successfully');
      await loadPermissions(selectedUser);
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      alert(`Failed to save permissions: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const selectedUserData = users.find(u => u.id === selectedUser);
  const userPerms = permissions.get(selectedUser) || new Set<string>();

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Module Permissions Management</h2>
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Select User
        </label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Choose a user...</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.email}) - {user.role}
            </option>
          ))}
        </select>
      </div>

      {selectedUser && selectedUserData && (
        <div>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-slate-900 mb-1">
              Managing permissions for: {selectedUserData.name}
            </h3>
            <p className="text-sm text-slate-600">
              Role: <span className="font-medium capitalize">{selectedUserData.role}</span>
            </p>
            <p className="text-sm text-slate-600 mt-1">
              Select which modules this user can access. Current selections are based on their role.
            </p>
          </div>

          {/* Special Administrative Permissions Section */}
          {AVAILABLE_MODULES.filter(m => m.special).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-600" />
                Administrative Permissions
              </h3>
              <div className="space-y-3">
                {AVAILABLE_MODULES.filter(m => m.special).map((module) => (
                  <div
                    key={module.name}
                    className={`p-5 border-3 rounded-lg transition-all ${
                      userPerms.has(module.name)
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-orange-200 bg-white'
                    }`}
                  >
                    <label className="flex items-start gap-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userPerms.has(module.name)}
                        onChange={() => togglePermission(selectedUser, module.name)}
                        className="w-6 h-6 text-orange-600 border-orange-300 rounded focus:ring-2 focus:ring-orange-500 cursor-pointer mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 text-base mb-1">
                          {module.label}
                        </div>
                        <div className="text-sm text-slate-700">
                          {module.description}
                        </div>
                        <div className="mt-2 text-xs text-orange-700 font-medium">
                          ⚠️ This grants elevated privileges. Use with caution.
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regular Module Permissions */}
          <h3 className="text-lg font-bold text-slate-900 mb-3">Module Access</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {AVAILABLE_MODULES.filter(m => !m.special).map((module) => (
              <button
                key={module.name}
                onClick={() => togglePermission(selectedUser, module.name)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  userPerms.has(module.name)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {userPerms.has(module.name) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 mb-1">
                      {module.label}
                    </div>
                    <div className="text-xs text-slate-600">
                      {module.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={savePermissions}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      )}

      {!selectedUser && (
        <div className="text-center py-12 text-slate-500">
          Select a user to manage their module permissions
        </div>
      )}
    </div>
  );
}
