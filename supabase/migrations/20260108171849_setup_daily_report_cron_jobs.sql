/*
  # Setup Daily Report Cron Jobs

  1. Cron Jobs
    - Daily Report Checking (Monday-Thursday 8 PM Eastern / 1 AM UTC)
      - Checks if users submitted their daily reports
      - Creates reminder records for missing reports
    
    - Daily Report Reminders (Tuesday-Friday 8 AM Eastern / 1 PM UTC)
      - Sends reminder emails for missing daily reports from previous day
      - Only sends to users who require daily reports
    
    - Weekly Report Checking (Friday 8 PM Eastern / 1 AM UTC Saturday)
      - Existing job, checks for weekly reports
    
    - Weekly Report Reminders (Monday 8 AM Eastern / 1 PM UTC)
      - Existing job, sends reminders for missing weekly reports
  
  2. Notes
    - Times are in UTC and may need adjustment for Daylight Saving Time
    - EST is UTC-5, EDT is UTC-4
    - Daily checks run at 1 AM UTC (8 PM EST / 9 PM EDT)
    - Daily reminders run at 1 PM UTC (8 AM EST / 9 AM EDT)
    - Using pg_cron for scheduling
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron jobs if they exist (to avoid duplicates)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN (
  'check_daily_reports_mon_thu',
  'send_daily_report_reminders_tue_fri',
  'check_weekly_reports_friday',
  'send_weekly_report_reminders_monday'
);

-- Daily Report Checking: Monday-Thursday at 1 AM UTC (8 PM EST / 9 PM EDT)
-- Runs on days 1-4 (Monday-Thursday)
SELECT cron.schedule(
  'check_daily_reports_mon_thu',
  '0 1 * * 1-4',
  $$
  SELECT check_missing_reports('daily');
  $$
);

-- Daily Report Reminders: Tuesday-Friday at 1 PM UTC (8 AM EST / 9 AM EDT)
-- Runs on days 2-5 (Tuesday-Friday) to send reminders for previous day
SELECT cron.schedule(
  'send_daily_report_reminders_tue_fri',
  '0 13 * * 2-5',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-report-reminders?type=daily',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- Weekly Report Checking: Friday at 1 AM UTC Saturday (Friday 8 PM EST / 9 PM EDT)
SELECT cron.schedule(
  'check_weekly_reports_friday',
  '0 1 * * 6',
  $$
  SELECT check_missing_reports('weekly');
  $$
);

-- Weekly Report Reminders: Monday at 1 PM UTC (Monday 8 AM EST / 9 AM EDT)
SELECT cron.schedule(
  'send_weekly_report_reminders_monday',
  '0 13 * * 1',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-report-reminders?type=weekly',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- Store the Supabase URL and service role key as settings
-- Note: These should be set via environment variables or Supabase dashboard
DO $$
BEGIN
  -- These are placeholders and should be set properly via environment
  PERFORM set_config('app.settings.supabase_url', current_setting('SUPABASE_URL', true), false);
  PERFORM set_config('app.settings.supabase_service_role_key', current_setting('SUPABASE_SERVICE_ROLE_KEY', true), false);
EXCEPTION
  WHEN OTHERS THEN
    -- If settings cannot be read, that's okay for now
    -- They need to be configured via the Supabase dashboard
    RAISE NOTICE 'Note: Supabase settings need to be configured via dashboard';
END $$;
