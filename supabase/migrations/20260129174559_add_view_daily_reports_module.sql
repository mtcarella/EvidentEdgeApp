/*
  # Add View Daily Reports Module Permission

  1. Changes
    - Adds a new module permission called "view_daily_reports"
    - This separates viewing daily reports from viewing weekly reports
    - Users with "weekly_reports" permission can view weekly performance reports
    - Users with "view_daily_reports" permission can view daily reports
    - This allows granular control over who can see which report types

  2. Initial Permissions
    - Processors, sales_processors, closers, and super_admin get view_daily_reports
    - Regular admins do NOT get view_daily_reports by default (can be granted later)
    - This ensures users like Razie can view weekly reports without seeing daily reports

  3. Security
    - Uses existing RLS policies from user_module_permissions table
    - Only admins and super_admins can modify these permissions
*/

-- Add view_daily_reports permission for appropriate roles
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  sp.id,
  'view_daily_reports',
  true
FROM sales_people sp
WHERE 
  -- Only give daily report access to processors, sales_processors, closers, and super_admin
  sp.role IN ('processor', 'sales_processor', 'closer', 'super_admin')
  AND sp.is_active = true
  -- Don't create duplicates
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id
    AND ump.module_name = 'view_daily_reports'
  );