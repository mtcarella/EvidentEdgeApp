/*
# Add lunch_log module permission for admins

1. Changes
   - Inserts a `lunch_log` module permission for all admin/super_admin/processor/sales_processor users
   - This allows admins to access the Lunch Log view to see all employees' lunch sessions and weekly tallies

2. Security
   - Uses existing user_module_permissions table and RLS policies
   - user_id column references sales_people.id
*/

INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT sp.id, 'lunch_log', true
FROM sales_people sp
WHERE sp.role IN ('admin', 'super_admin', 'processor', 'sales_processor')
  AND sp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id AND ump.module_name = 'lunch_log'
  );
