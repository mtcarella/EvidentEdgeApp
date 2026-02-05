/*
  # Enable Weekly Reports Access for Daily Report Viewers

  1. Changes
    - Grant `weekly_reports` module permission to all users who have `view_daily_reports`
    - This ensures users can access the Performance Reports view to see their daily reports
    - Users who can submit daily reports should be able to view them
    
  2. Security
    - Uses existing RLS policies from user_module_permissions table
    - Daily reports visibility is still controlled by the `view_daily_reports` permission within the view
*/

-- Grant weekly_reports access to users who have view_daily_reports
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  ump.user_id,
  'weekly_reports',
  true
FROM user_module_permissions ump
WHERE 
  ump.module_name = 'view_daily_reports'
  AND ump.has_access = true
  -- Don't create duplicates
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump2
    WHERE ump2.user_id = ump.user_id
    AND ump2.module_name = 'weekly_reports'
  )
ON CONFLICT (user_id, module_name) 
DO UPDATE SET has_access = true;
