/*
  # Add contact budget requests module permissions

  1. Changes
    - Insert `my_budget_requests` module permission for all active users
    - Insert `budget_requests` module permission for super_admin users

  2. Notes
    - user_module_permissions.user_id references sales_people.id
    - All active users can see their own budget request history
    - Only super admins can manage/approve budget requests
*/

INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT sp.id, 'my_budget_requests', true
FROM sales_people sp
WHERE sp.is_active = true
  AND sp.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id
      AND ump.module_name = 'my_budget_requests'
  );

INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT sp.id, 'budget_requests', true
FROM sales_people sp
WHERE sp.is_active = true
  AND sp.user_id IS NOT NULL
  AND sp.role = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id
      AND ump.module_name = 'budget_requests'
  );
