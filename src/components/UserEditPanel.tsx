import { useState, useEffect } from 'react';
import { Save, X, CheckSquare, Square, Shield, RefreshCw, Key, DollarSign, Users, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDialog } from '../contexts/DialogContext';

interface SalesPerson {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  cell_phone?: string | null;
  role: string;
  is_active: boolean;
  birthday?: string | null;
  requires_daily_reports?: boolean;
  requires_weekly_reports?: boolean;
  force_password_reset?: boolean;
  chat_enabled?: boolean;
  budget?: number;
  budget_display_enabled?: boolean;
  budget_edit_enabled?: boolean;
  friends_family_enabled?: boolean;
  file_viewer_enabled?: boolean;
}

interface UserEditPanelProps {
  user: SalesPerson;
  onSave: () => void;
  onCancel: () => void;
}

const AVAILABLE_MODULES = [
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
  { name: 'meeting_logs_report', label: 'Meeting Logs Report', description: 'View meeting logs' },
  { name: 'admin_panel', label: 'Admin Panel', description: 'Database management' },
  { name: 'audit_log', label: 'Audit Log', description: 'View audit logs' },
  { name: 'import_data', label: 'Import Data', description: 'Import contact data' },
  { name: 'resources', label: 'Resources', description: 'View company resources' },
  { name: 'conflict_check', label: 'Conflict Check', description: 'Check for conflicts' },
  { name: 'yankees_tickets', label: 'Yankees Tickets', description: 'View and request Yankees game tickets' },
  { name: 'budget_display', label: 'Budget Display', description: 'Show budget balance on main page' },
  { name: 'budget_edit', label: 'Budget Edit', description: 'Allow admin to edit user budget' },
];

export function UserEditPanel({ user, onSave, onCancel }: UserEditPanelProps) {
  const dialog = useDialog();
  const [editForm, setEditForm] = useState({
    name: user.name,
    email: user.email,
    cell_phone: user.cell_phone || '',
    role: user.role,
    is_active: user.is_active,
    birthday: user.birthday || '',
    requires_daily_reports: user.requires_daily_reports || false,
    requires_weekly_reports: user.requires_weekly_reports || false,
    force_password_reset: user.force_password_reset || false,
    chat_enabled: user.chat_enabled !== false,
    budget_display_enabled: user.budget_display_enabled || false,
    budget_edit_enabled: user.budget_edit_enabled || false,
    budget: user.budget ?? 0,
    friends_family_enabled: user.friends_family_enabled || false,
    file_viewer_enabled: user.file_viewer_enabled || false,
  });
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState('');

  useEffect(() => {
    loadPermissions();
  }, [user.id]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_module_permissions')
        .select('module_name, has_access')
        .eq('user_id', user.id);

      if (error) throw error;

      const userPermissions = new Set<string>();
      data?.forEach((perm) => {
        if (perm.has_access) {
          userPermissions.add(perm.module_name);
        }
      });
      setPermissions(userPermissions);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (moduleName: string) => {
    const newPermissions = new Set(permissions);
    if (newPermissions.has(moduleName)) {
      newPermissions.delete(moduleName);
    } else {
      newPermissions.add(moduleName);
    }
    setPermissions(newPermissions);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        name: editForm.name,
        email: editForm.email,
        cell_phone: editForm.cell_phone || null,
        role: editForm.role,
        is_active: editForm.is_active,
        birthday: editForm.birthday || null,
        requires_daily_reports: editForm.requires_daily_reports,
        requires_weekly_reports: editForm.requires_weekly_reports,
        force_password_reset: editForm.force_password_reset,
        chat_enabled: editForm.chat_enabled,
        budget_display_enabled: editForm.budget_display_enabled,
        budget_edit_enabled: editForm.budget_edit_enabled,
        friends_family_enabled: editForm.friends_family_enabled,
        file_viewer_enabled: editForm.file_viewer_enabled,
      };

      if (editForm.budget_edit_enabled) {
        updateData.budget = editForm.budget;
      }

      const { error: userError } = await supabase
        .from('sales_people')
        .update(updateData)
        .eq('id', user.id);

      if (userError) throw userError;

      const syncedPermissions = new Set(permissions);
      if (editForm.budget_display_enabled) syncedPermissions.add('budget_display');
      else syncedPermissions.delete('budget_display');
      if (editForm.budget_edit_enabled) syncedPermissions.add('budget_edit');
      else syncedPermissions.delete('budget_edit');

      const permissionsToUpsert = AVAILABLE_MODULES.map((module) => ({
        user_id: user.id,
        module_name: module.name,
        has_access: syncedPermissions.has(module.name),
      }));

      const { error: permError } = await supabase
        .from('user_module_permissions')
        .upsert(permissionsToUpsert, {
          onConflict: 'user_id,module_name',
        });

      if (permError) throw permError;

      onSave();
    } catch (error: any) {
      console.error('Error saving user:', error);
      const message = error?.message || (typeof error === 'string' ? error : 'Unknown error');
      await dialog.alert(`Failed to save: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleAll = () => {
    if (permissions.size === AVAILABLE_MODULES.length) {
      setPermissions(new Set());
    } else {
      setPermissions(new Set(AVAILABLE_MODULES.map((m) => m.name)));
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword) {
      await dialog.alert('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      await dialog.alert('Password must be at least 6 characters');
      return;
    }
    if (!user.user_id) {
      await dialog.alert('User does not have a user_id, cannot reset password');
      return;
    }

    setResettingPassword(true);
    setPasswordResetMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: user.user_id,
            newPassword: newPassword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      setPasswordResetMessage('Password reset successfully!');
      setNewPassword('');
      setTimeout(() => setPasswordResetMessage(''), 3000);
    } catch (error) {
      console.error('Error resetting password:', error);
      await dialog.alert(`Failed to reset password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Edit User: {user.name}</h3>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save All'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Cell Phone
            </label>
            <input
              type="tel"
              value={editForm.cell_phone}
              onChange={(e) => setEditForm({ ...editForm, cell_phone: e.target.value })}
              placeholder="+12345678900 (E.164 format for SMS)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">Required for SMS notifications. Use E.164 format: +[country code][number]</p>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reset Password
            </label>
            {!user.user_id ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                <p className="text-sm text-yellow-800">This user does not have an auth account. Cannot reset password.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={resettingPassword || !newPassword}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <Key className="w-4 h-4" />
                    {resettingPassword ? 'Resetting...' : 'Reset'}
                  </button>
                </div>
                {passwordResetMessage && (
                  <p className="mt-2 text-sm text-green-600 font-medium">{passwordResetMessage}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">User will need to log in with the new password immediately.</p>
              </>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Force Password Reset on Next Login
            </label>
            <div
              className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50"
              onClick={() => setEditForm({ ...editForm, force_password_reset: !editForm.force_password_reset })}
            >
              {editForm.force_password_reset ? (
                <CheckSquare className="w-5 h-5 text-orange-600" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
              <span className="text-sm text-slate-700">Require password change on next login</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">When enabled, this user will be prompted to create a new password the next time they log in.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="salesperson">Salesperson</option>
              <option value="closer">Closer</option>
              <option value="processor">Processor</option>
              <option value="sales_processor">Sales Processor</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Active Status <span className="text-red-500">*</span>
            </label>
            <select
              value={editForm.is_active ? 'yes' : 'no'}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'yes' })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Chat Feature
            </label>
            <select
              value={editForm.chat_enabled ? 'yes' : 'no'}
              onChange={(e) => setEditForm({ ...editForm, chat_enabled: e.target.value === 'yes' })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">Enable or disable chat/messaging feature for this user</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Birthday
            </label>
            <input
              type="date"
              value={editForm.birthday}
              onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
              placeholder="YYYY-MM-DD"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">You can type the date (YYYY-MM-DD) or use the calendar</p>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Report Requirements
            </label>
            <div className="space-y-3">
              <div
                className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50"
                onClick={() => setEditForm({ ...editForm, requires_daily_reports: !editForm.requires_daily_reports })}
              >
                {editForm.requires_daily_reports ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-sm text-slate-700">Daily Reports Required</span>
              </div>
              <div
                className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50"
                onClick={() => setEditForm({ ...editForm, requires_weekly_reports: !editForm.requires_weekly_reports })}
              >
                {editForm.requires_weekly_reports ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-sm text-slate-700">Weekly Reports Required</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Budget Settings
            </label>
            <div className="space-y-3">
              <div
                className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50"
                onClick={() => setEditForm({ ...editForm, budget_display_enabled: !editForm.budget_display_enabled })}
              >
                {editForm.budget_display_enabled ? (
                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-sm text-slate-700">Enable Budget Display</span>
              </div>
              <div
                className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50"
                onClick={() => setEditForm({ ...editForm, budget_edit_enabled: !editForm.budget_edit_enabled })}
              >
                {editForm.budget_edit_enabled ? (
                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-sm text-slate-700">Enable Budget Edit</span>
              </div>
              {editForm.budget_edit_enabled && (
                <div className="ml-8">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Budget Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.budget}
                      onChange={(e) => setEditForm({ ...editForm, budget: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Set the user's budget balance</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-600" />
              Friends and Family
            </label>
            <div
              className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50"
              onClick={() => setEditForm({ ...editForm, friends_family_enabled: !editForm.friends_family_enabled })}
            >
              {editForm.friends_family_enabled ? (
                <CheckSquare className="w-5 h-5 text-cyan-600" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
              <span className="text-sm text-slate-700">Enable Friends and Family</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">When enabled, this user can access the Friends and Family request feature</p>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              File Viewer
            </label>
            <div
              className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50"
              onClick={() => setEditForm({ ...editForm, file_viewer_enabled: !editForm.file_viewer_enabled })}
            >
              {editForm.file_viewer_enabled ? (
                <CheckSquare className="w-5 h-5 text-blue-600" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
              <span className="text-sm text-slate-700">Enable File Viewer</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">When enabled, this user can access the File Viewer module to search document intake records</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-slate-900">Module Permissions</h4>
            </div>
            <button
              onClick={toggleAll}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              {permissions.size === AVAILABLE_MODULES.length ? (
                <>
                  <CheckSquare className="w-4 h-4" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  Select All
                </>
              )}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
              {AVAILABLE_MODULES.map((module) => (
                <div
                  key={module.name}
                  className="flex items-start gap-3 p-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer"
                  onClick={() => togglePermission(module.name)}
                >
                  <div className="pt-0.5">
                    {permissions.has(module.name) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900">{module.label}</div>
                    <div className="text-sm text-slate-500">{module.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
