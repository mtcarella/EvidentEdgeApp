/*
  # Update Reminder System for Daily Reports

  1. Changes
    - Add `report_type` column to `performance_report_reminders` table
      - Type: text
      - Values: 'daily' or 'weekly'
      - Description: Indicates whether this is a daily or weekly report reminder
    - Add `report_date` column to track specific dates for daily reports
    - Update unique constraint to include report_type and report_date
    - Update check_missing_reports function to handle both daily and weekly
    - Update get_users_needing_reminders function to filter by report type
  
  2. Notes
    - Daily reports are checked Monday-Thursday at 8 PM, reminders sent next day at 8 AM
    - Weekly reports are checked Friday at 8 PM, reminders sent Monday at 8 AM
    - Users can be configured to require daily, weekly, or both types of reports
*/

-- Add new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_report_reminders' AND column_name = 'report_type'
  ) THEN
    ALTER TABLE performance_report_reminders 
    ADD COLUMN report_type text DEFAULT 'weekly' CHECK (report_type IN ('daily', 'weekly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_report_reminders' AND column_name = 'report_date'
  ) THEN
    ALTER TABLE performance_report_reminders 
    ADD COLUMN report_date date;
  END IF;
END $$;

-- Drop old unique constraint and create new one
ALTER TABLE performance_report_reminders DROP CONSTRAINT IF EXISTS performance_report_reminders_user_id_week_ending_date_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'performance_report_reminders_unique_reminder'
  ) THEN
    ALTER TABLE performance_report_reminders 
    ADD CONSTRAINT performance_report_reminders_unique_reminder 
    UNIQUE(user_id, week_ending_date, report_type, report_date);
  END IF;
END $$;

-- Update check_missing_reports function to handle both daily and weekly reports
CREATE OR REPLACE FUNCTION check_missing_reports(check_type text DEFAULT 'weekly')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_friday date;
  check_date date;
  user_record RECORD;
BEGIN
  IF check_type = 'weekly' THEN
    -- Get the most recent Friday for weekly reports
    current_friday := CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::integer + 2) % 7;
    
    -- Loop through all active users who require weekly reports
    FOR user_record IN 
      SELECT id, user_id, name, role
      FROM sales_people
      WHERE requires_weekly_reports = true
      AND is_active = true
      AND user_id IS NOT NULL
    LOOP
      -- Check if they submitted a weekly report for this week
      IF NOT EXISTS (
        SELECT 1 
        FROM weekly_performance_reports
        WHERE processor_id = user_record.id
        AND report_date >= current_friday - INTERVAL '6 days'
        AND report_date <= current_friday
        AND report_type IN ('paralegal_post_closing', 'recording', 'title')
      ) THEN
        -- Create reminder record if it doesn't exist
        INSERT INTO performance_report_reminders (user_id, week_ending_date, report_type, report_date)
        VALUES (user_record.id, current_friday, 'weekly', current_friday)
        ON CONFLICT (user_id, week_ending_date, report_type, report_date) 
        DO UPDATE SET 
          report_submitted = false,
          updated_at = now();
      ELSE
        -- Mark as submitted if they did submit
        INSERT INTO performance_report_reminders (user_id, week_ending_date, report_submitted, report_type, report_date)
        VALUES (user_record.id, current_friday, true, 'weekly', current_friday)
        ON CONFLICT (user_id, week_ending_date, report_type, report_date)
        DO UPDATE SET 
          report_submitted = true,
          updated_at = now();
      END IF;
    END LOOP;
    
  ELSIF check_type = 'daily' THEN
    -- For daily reports, check today's date
    check_date := CURRENT_DATE;
    current_friday := CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::integer + 2) % 7;
    
    -- Loop through all active users who require daily reports
    FOR user_record IN 
      SELECT id, user_id, name, role
      FROM sales_people
      WHERE requires_daily_reports = true
      AND is_active = true
      AND user_id IS NOT NULL
    LOOP
      -- Check if they submitted a daily report for today
      IF NOT EXISTS (
        SELECT 1 
        FROM weekly_performance_reports
        WHERE processor_id = user_record.id
        AND report_date = check_date
        AND report_type = 'daily'
      ) THEN
        -- Create reminder record if it doesn't exist
        INSERT INTO performance_report_reminders (user_id, week_ending_date, report_type, report_date)
        VALUES (user_record.id, current_friday, 'daily', check_date)
        ON CONFLICT (user_id, week_ending_date, report_type, report_date) 
        DO UPDATE SET 
          report_submitted = false,
          updated_at = now();
      ELSE
        -- Mark as submitted if they did submit
        INSERT INTO performance_report_reminders (user_id, week_ending_date, report_submitted, report_type, report_date)
        VALUES (user_record.id, current_friday, true, 'daily', check_date)
        ON CONFLICT (user_id, week_ending_date, report_type, report_date)
        DO UPDATE SET 
          report_submitted = true,
          updated_at = now();
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- Update get_users_needing_reminders function to filter by report type
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
    AND (
      (reminder_type = 'weekly' AND prr.week_ending_date >= CURRENT_DATE - INTERVAL '7 days')
      OR
      (reminder_type = 'daily' AND prr.report_date >= CURRENT_DATE - INTERVAL '2 days')
    )
  ORDER BY sp.name;
END;
$$;

-- Create index for report_type and report_date
CREATE INDEX IF NOT EXISTS idx_performance_report_reminders_type_date 
  ON performance_report_reminders(report_type, report_date);
