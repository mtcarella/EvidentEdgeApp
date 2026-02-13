/*
  # Fix Report Reminder Trigger Search Path

  ## Problem
  The `mark_reminder_as_submitted` function has `SET search_path TO ''` which prevents it
  from finding the `performance_report_reminders` table.

  ## Solution
  Update the function to use fully qualified table names (public.performance_report_reminders)
  to ensure it works correctly regardless of search_path.
*/

CREATE OR REPLACE FUNCTION public.mark_reminder_as_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  current_friday date;
BEGIN
  -- Calculate the Friday of the week for this report
  current_friday := NEW.report_date - (EXTRACT(DOW FROM NEW.report_date)::integer + 2) % 7;

  -- Update reminders based on report type
  IF NEW.report_type = 'daily' THEN
    -- For daily reports, match by exact date
    UPDATE public.performance_report_reminders
    SET 
      report_submitted = true,
      updated_at = now()
    WHERE user_id = NEW.processor_id
      AND report_type = 'daily'
      AND report_date = NEW.report_date;

  ELSIF NEW.report_type IN ('paralegal_post_closing', 'recording', 'title', 'Weekly - Marlise') THEN
    -- For weekly reports, match by week_ending_date (the Friday of the week)
    UPDATE public.performance_report_reminders
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