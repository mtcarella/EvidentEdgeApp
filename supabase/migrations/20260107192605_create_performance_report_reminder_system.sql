/*
  # Create Performance Report Reminder System

  1. New Tables
    - `performance_report_reminders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to sales_people)
      - `week_ending_date` (date) - The Friday of the week being tracked
      - `reminder_sent` (boolean, default false)
      - `reminder_sent_at` (timestamptz, nullable)
      - `report_submitted` (boolean, default false)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `performance_report_reminders` table
    - Add policies for super_admin to manage all reminders
    - Add policies for users to view their own reminders

  3. Functions
    - `check_missing_reports()` - Checks which users haven't submitted reports for the week
    - `get_users_needing_reminders()` - Gets list of users who need reminder emails

  4. Notes
    - This table tracks which users need to be reminded about missing performance reports
    - The system will check every Friday at 8pm Eastern (1am UTC Saturday during EST)
    - Reminder emails will be queued for Monday 8am Eastern (1pm UTC Monday during EST)
    - Times may need adjustment for Daylight Saving Time (EDT is UTC-4 instead of UTC-5)
*/

-- Create performance_report_reminders table
CREATE TABLE IF NOT EXISTS performance_report_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  week_ending_date date NOT NULL,
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamptz,
  report_submitted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_ending_date)
);

-- Enable RLS
ALTER TABLE performance_report_reminders ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all reminders
CREATE POLICY "Super admin can manage all reminders"
  ON performance_report_reminders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
    )
  );

-- Users can view their own reminders
CREATE POLICY "Users can view own reminders"
  ON performance_report_reminders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = performance_report_reminders.user_id
      AND sales_people.user_id = auth.uid()
    )
  );

-- Function to check for missing reports (runs Friday 8pm Eastern / Saturday 1am UTC)
CREATE OR REPLACE FUNCTION check_missing_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_friday date;
  user_record RECORD;
BEGIN
  -- Get the most recent Friday
  current_friday := CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::integer + 2) % 7;
  
  -- Loop through all active processors, sales_processors, and closers
  FOR user_record IN 
    SELECT id, user_id, name, role
    FROM sales_people
    WHERE role IN ('processor', 'sales_processor', 'closer')
    AND user_id IS NOT NULL
  LOOP
    -- Check if they submitted a report for this week
    IF NOT EXISTS (
      SELECT 1 
      FROM weekly_performance_reports
      WHERE processor_id = user_record.id
      AND report_date >= current_friday - INTERVAL '6 days'
      AND report_date <= current_friday
    ) THEN
      -- Create reminder record if it doesn't exist
      INSERT INTO performance_report_reminders (user_id, week_ending_date)
      VALUES (user_record.id, current_friday)
      ON CONFLICT (user_id, week_ending_date) 
      DO UPDATE SET 
        report_submitted = false,
        updated_at = now();
    ELSE
      -- Mark as submitted if they did submit
      INSERT INTO performance_report_reminders (user_id, week_ending_date, report_submitted)
      VALUES (user_record.id, current_friday, true)
      ON CONFLICT (user_id, week_ending_date)
      DO UPDATE SET 
        report_submitted = true,
        updated_at = now();
    END IF;
  END LOOP;
END;
$$;

-- Function to get users who need reminder emails (runs Monday 8am Eastern / 1pm UTC)
CREATE OR REPLACE FUNCTION get_users_needing_reminders()
RETURNS TABLE (
  user_id uuid,
  user_email text,
  user_name text,
  week_ending_date date
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
    prr.week_ending_date
  FROM performance_report_reminders prr
  JOIN sales_people sp ON sp.id = prr.user_id
  JOIN auth.users au ON au.id = sp.user_id
  WHERE prr.reminder_sent = false
    AND prr.report_submitted = false
    AND prr.week_ending_date >= CURRENT_DATE - INTERVAL '7 days'
  ORDER BY sp.name;
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_performance_report_reminders_user_date 
  ON performance_report_reminders(user_id, week_ending_date);

CREATE INDEX IF NOT EXISTS idx_performance_report_reminders_pending 
  ON performance_report_reminders(reminder_sent, report_submitted) 
  WHERE reminder_sent = false AND report_submitted = false;