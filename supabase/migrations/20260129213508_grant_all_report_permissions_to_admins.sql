/*
  # Grant All Report Permissions to Admins and Super Admins

  1. Changes
    - Grant `weekly_reports` module permission to all admins and super_admins
    - Grant `view_daily_reports` module permission to all admins and super_admins
    - Ensures all admins can view all types of performance reports (weekly and daily)
    
  2. Security
    - Uses existing RLS policies from user_module_permissions table
    - RLS policies on weekly_performance_reports already allow admins to view all reports
    - This ensures the UI permissions match the database-level RLS policies
*/

-- Grant weekly_reports access to all admins and super_admins
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  sp.id,
  'weekly_reports',
  true
FROM sales_people sp
WHERE 
  sp.role IN ('admin', 'super_admin')
  AND sp.is_active = true
ON CONFLICT (user_id, module_name) 
DO UPDATE SET has_access = true;

-- Grant view_daily_reports access to all admins and super_admins
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  sp.id,
  'view_daily_reports',
  true
FROM sales_people sp
WHERE 
  sp.role IN ('admin', 'super_admin')
  AND sp.is_active = true
ON CONFLICT (user_id, module_name) 
DO UPDATE SET has_access = true;
