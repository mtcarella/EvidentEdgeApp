/*
  # Fix Report Reminders to Update When Report is Submitted

  1. Changes
    - Add trigger function to automatically mark reminders as submitted
    - Trigger runs when a report is inserted into weekly_performance_reports
    - Updates the corresponding performance_report_reminders record
    - Sets report_submitted = true and updates updated_at timestamp

  2. Notes
    - This fixes the issue where users get reminder emails even after submitting reports
    - The trigger handles both daily and weekly reports
    - For weekly reports, it matches by week (report_date within the week of week_ending_date)
    - For daily reports, it matches by exact report_date
*/

-- Create trigger function to mark reminders as submitted when a report is submitted
CREATE OR REPLACE FUNCTION mark_reminder_as_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_friday date;
BEGIN
  -- Calculate the Friday of the week for this report
  current_friday := NEW.report_date - (EXTRACT(DOW FROM NEW.report_date)::integer + 2) % 7;
  
  -- Update reminders based on report type
  IF NEW.report_type = 'daily' THEN
    -- For daily reports, match by exact date
    UPDATE performance_report_reminders
    SET 
      report_submitted = true,
      updated_at = now()
    WHERE user_id = NEW.processor_id
      AND report_type = 'daily'
      AND report_date = NEW.report_date;
      
  ELSIF NEW.report_type IN ('paralegal_post_closing', 'recording', 'title', 'Weekly - Marlise') THEN
    -- For weekly reports, match by week_ending_date (the Friday of the week)
    UPDATE performance_report_reminders
    SET 
      report_submitted = true,
      updated_at = now()
    WHERE user_id = NEW.processor_id
      AND report_type = 'weekly'
      AND week_ending_date = current_friday;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trigger_mark_reminder_submitted ON weekly_performance_reports;

CREATE TRIGGER trigger_mark_reminder_submitted
  AFTER INSERT ON weekly_performance_reports
  FOR EACH ROW
  EXECUTE FUNCTION mark_reminder_as_submitted();

-- Also update any existing reminders where reports have already been submitted
DO $$
DECLARE
  report_record RECORD;
  current_friday date;
BEGIN
  -- Update daily report reminders
  FOR report_record IN 
    SELECT DISTINCT processor_id, report_date
    FROM weekly_performance_reports
    WHERE report_type = 'daily'
  LOOP
    UPDATE performance_report_reminders
    SET 
      report_submitted = true,
      updated_at = now()
    WHERE user_id = report_record.processor_id
      AND report_type = 'daily'
      AND report_date = report_record.report_date
      AND report_submitted = false;
  END LOOP;
  
  -- Update weekly report reminders
  FOR report_record IN 
    SELECT DISTINCT processor_id, report_date
    FROM weekly_performance_reports
    WHERE report_type IN ('paralegal_post_closing', 'recording', 'title', 'Weekly - Marlise')
  LOOP
    current_friday := report_record.report_date - (EXTRACT(DOW FROM report_record.report_date)::integer + 2) % 7;
    
    UPDATE performance_report_reminders
    SET 
      report_submitted = true,
      updated_at = now()
    WHERE user_id = report_record.processor_id
      AND report_type = 'weekly'
      AND week_ending_date = current_friday
      AND report_submitted = false;
  END LOOP;
END $$;
