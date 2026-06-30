/*
  # Add Manage Friends & Family Requests Module Permission
  
  Seeds the budget_requests module permission for admin and super_admin users
  so they can review and manage Friends & Family requests from the sales team.
*/

INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  sp.id,
  'budget_requests',
  true
FROM sales_people sp
WHERE 
  sp.role IN ('admin', 'super_admin')
  AND sp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id
    AND ump.module_name = 'budget_requests'
  );
