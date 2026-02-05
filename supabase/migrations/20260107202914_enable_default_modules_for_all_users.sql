/*
  # Enable Default Modules for All Users

  1. Changes
    - Enables the following modules for all existing users:
      - dashboard
      - contact_search
      - submit_performance_report
      - resources
      - conflict_check
    
  2. Implementation
    - Uses INSERT ... ON CONFLICT to ensure permissions are set
    - Applies to all users in the sales_people table
    - Sets has_access = true for each default module
*/

-- Enable default modules for all existing users
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  sp.id as user_id,
  module.name as module_name,
  true as has_access
FROM 
  sales_people sp
CROSS JOIN (
  SELECT 'dashboard' as name
  UNION ALL SELECT 'contact_search'
  UNION ALL SELECT 'submit_performance_report'
  UNION ALL SELECT 'resources'
  UNION ALL SELECT 'conflict_check'
) as module
ON CONFLICT (user_id, module_name) 
DO UPDATE SET has_access = true;
