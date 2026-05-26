/*
  # Add prospect_requests module permissions

  1. Changes
    - Insert `my_prospect_requests` module permission for all active users
    - Insert `prospect_requests` module permission for super_admin users
  
  2. Notes
    - user_module_permissions.user_id references sales_people.id
*/

INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT sp.id, 'my_prospect_requests', true
FROM sales_people sp
WHERE sp.is_active = true
  AND sp.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id
      AND ump.module_name = 'my_prospect_requests'
  );

INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT sp.id, 'prospect_requests', true
FROM sales_people sp
WHERE sp.is_active = true
  AND sp.user_id IS NOT NULL
  AND sp.role = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id
      AND ump.module_name = 'prospect_requests'
  );
