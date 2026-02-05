/*
  # Fix get_users_needing_reminders Function Email Type

  ## Issue
  The function returns `user_email text` but `auth.users.email` is `varchar(255)`,
  causing a type mismatch error.

  ## Changes
  - Cast the email field to text explicitly
  - This ensures the return type matches the function signature
*/

-- Drop the old function versions
DROP FUNCTION IF EXISTS get_users_needing_reminders();
DROP FUNCTION IF EXISTS get_users_needing_reminders(text);

-- Recreate with proper type casting
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
    au.email::text as user_email,
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
    AND (
      (reminder_type = 'weekly' AND prr.week_ending_date >= CURRENT_DATE - INTERVAL '7 days')
      OR
      (reminder_type = 'daily' AND prr.report_date >= CURRENT_DATE - INTERVAL '2 days')
    )
  ORDER BY sp.name;
END;
$$;
