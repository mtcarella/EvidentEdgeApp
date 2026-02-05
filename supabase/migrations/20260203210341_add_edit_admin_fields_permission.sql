/*
  # Add Edit Admin Fields Permission

  1. Purpose
    - Creates a new module permission 'edit_admin_fields' for controlling access to sensitive contact fields
    - Grants this permission to all existing admin and super_admin users by default

  2. Fields Controlled by This Permission
    - Assignment (Assigned To)
    - Paralegal (for attorney contacts)
    - Preferred Surveyor
    - Preferred UW
    - Preferred Closer
    - Processor Notes

  3. Security
    - Only users with this permission can edit the above fields
    - Permission is managed through the Module Permissions Manager in the Admin Panel
    - By default, granted to admin and super_admin roles only
*/

-- Grant edit_admin_fields permission to all admin and super_admin users
INSERT INTO user_module_permissions (user_id, module_name, has_access, granted_by, updated_at)
SELECT
  sp.id,
  'edit_admin_fields',
  true,
  au.id, -- Use the first admin's auth user id as granted_by
  now()
FROM sales_people sp
CROSS JOIN LATERAL (
  SELECT au.id
  FROM auth.users au
  INNER JOIN sales_people sp_admin ON au.id = sp_admin.id
  WHERE sp_admin.role IN ('admin', 'super_admin')
    AND sp_admin.is_active = true
  LIMIT 1
) au
WHERE sp.role IN ('admin', 'super_admin')
  AND sp.is_active = true
ON CONFLICT (user_id, module_name)
DO UPDATE SET
  has_access = true,
  updated_at = now();
