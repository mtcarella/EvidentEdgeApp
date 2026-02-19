/*
  # Add View Communications Module Permission for All Users

  1. Changes
    - Add 'view_communications' module permission for all active users
    - This allows all staff to view office communications sent to them
    - The 'employee_communication' module remains admin-only for sending and managing

  2. Security
    - All authenticated users can view communications they are part of
    - Only admins can send and manage communications (via employee_communication module)
*/

-- Grant view communications permission to all active users
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  sp.id,
  'view_communications',
  true
FROM sales_people sp
WHERE sp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id
    AND ump.module_name = 'view_communications'
  );
