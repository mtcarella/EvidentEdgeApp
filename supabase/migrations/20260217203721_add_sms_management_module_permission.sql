/*
  # Add SMS Management Module Permission

  1. Changes
    - Add 'sms_management' to available module permissions
    - Grant 'sms_management' permission to all admin and super_admin users

  2. Security
    - Only admins and super admins can access SMS opt-in management view
    - This allows tracking and compliance management of SMS consent records
*/

-- Grant SMS management permission to all admin and super_admin users
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  sp.id,
  'sms_management',
  true
FROM sales_people sp
WHERE sp.role IN ('admin', 'super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id
    AND ump.module_name = 'sms_management'
  );
