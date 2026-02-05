/*
  # Add Manage Permissions Module

  1. Changes
    - Grant 'manage_permissions' module access to all super_admin users
    - This allows admins to control which users can manage other users' permissions
  
  2. Security
    - Only super_admin users get this permission by default
    - Other users must be explicitly granted this permission through the UI
*/

-- Grant manage_permissions access to all super_admin users
INSERT INTO user_module_permissions (user_id, module_name, has_access, granted_by)
SELECT 
  sp.id,
  'manage_permissions',
  true,
  sp.user_id  -- Use auth.users id for granted_by
FROM sales_people sp
WHERE sp.role = 'super_admin' AND sp.user_id IS NOT NULL
ON CONFLICT (user_id, module_name) DO UPDATE
SET has_access = true;
