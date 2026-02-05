/*
  # Fix Reminder System to Check Report Requirements

  1. Changes
    - Update `get_users_needing_reminders` function to verify users still have report requirements
    - Ensures users who have had `requires_daily_reports` or `requires_weekly_reports` unchecked
      will not receive reminders even if old reminder records exist in the database

  2. Security
    - Maintains existing SECURITY DEFINER context
    - No changes to permissions or access control
*/

-- Update get_users_needing_reminders to check report requirement flags
CREATE OR REPLACE FUNCTION get_users_needing_reminders(reminder_type text DEFAULT 'weekly')
RETURNS TABLE (
  user_id uuid,
  user_email text,
  user_name text,
  week_ending_date date,
  report_type text,
  report_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.user_id,
    au.email as user_email,
    sp.name as user_name,
    prr.week_ending_date,
    prr.report_type,
    prr.report_date
  FROM performance_report_reminders prr
  JOIN sales_people sp ON sp.id = prr.user_id
  JOIN auth.users au ON au.id = sp.user_id
  WHERE prr.reminder_sent = false
    AND prr.report_submitted = false
    AND prr.report_type = reminder_type
    AND sp.is_active = true
    -- Check that the user still has the report requirement enabled
    AND (
      (reminder_type = 'weekly' AND sp.requires_weekly_reports = true)
      OR
      (reminder_type = 'daily' AND sp.requires_daily_reports = true)
    )
    AND (
      (reminder_type = 'weekly' AND prr.week_ending_date >= CURRENT_DATE - INTERVAL '7 days')
      OR
      (reminder_type = 'daily' AND prr.report_date >= CURRENT_DATE - INTERVAL '2 days')
    )
  ORDER BY sp.name;
END;
$$;