/*
  # Fix Cron Jobs with Direct Values

  ## Issue
  The cron jobs were trying to use `current_setting()` to get the Supabase URL and service role key,
  but these settings aren't available. We need to update the cron jobs to use the actual values.

  ## Changes
  - Update daily report reminder cron job with actual Supabase URL
  - Update weekly report reminder cron job with actual Supabase URL
  - Use direct values instead of app settings
*/

-- Update the daily report reminder cron job
SELECT cron.unschedule('send_daily_report_reminders_tue_fri');

SELECT cron.schedule(
  'send_daily_report_reminders_tue_fri',
  '0 13 * * 2-5', -- 1 PM UTC (8 AM EST) Tuesday-Friday
  $$
  SELECT
    net.http_post(
      url := 'https://qopxgmdizdlcxecvnwka.supabase.co/functions/v1/send-report-reminders?type=daily',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvcHhnbWRpemRsY3hlY3Zud2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTQwOTYsImV4cCI6MjA3NjQ3MDA5Nn0.seC1MxHmBZiJGFbkhr2kP7_eWQ2JNLbuu88atyR04Zo',
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- Update the weekly report reminder cron job
SELECT cron.unschedule('send_weekly_report_reminders_monday');

SELECT cron.schedule(
  'send_weekly_report_reminders_monday',
  '0 13 * * 1', -- 1 PM UTC (8 AM EST) on Mondays
  $$
  SELECT
    net.http_post(
      url := 'https://qopxgmdizdlcxecvnwka.supabase.co/functions/v1/send-report-reminders?type=weekly',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvcHhnbWRpemRsY3hlY3Zud2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTQwOTYsImV4cCI6MjA3NjQ3MDA5Nn0.seC1MxHmBZiJGFbkhr2kP7_eWQ2JNLbuu88atyR04Zo',
        'Content-Type', 'application/json'
      )
    );
  $$
);
