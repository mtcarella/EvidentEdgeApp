/*
  # Fix Daily Reminder Schedule - Tuesday-Friday Only

  ## Issue
  Daily reports are due Monday-Thursday, so reminders should only go out
  Tuesday-Friday (the day after), not Wednesday-Saturday.

  ## Changes
  - Update daily report reminder cron to run Tuesday-Friday only
    - Reports due Monday-Thursday
    - Reminders sent Tuesday-Friday at 8 AM EST (day after due)

  ## Schedule
  - Daily reports due: Monday-Thursday
  - Daily reminders sent: Tuesday-Friday 8 AM EST (day after due)

  - Weekly reports due: Monday
  - Weekly reminders sent: Tuesday 8 AM EST (day after due)
*/

-- Drop the incorrect Wednesday-Saturday schedule
SELECT cron.unschedule('send_daily_report_reminders_wed_sat');

-- Create the correct Tuesday-Friday schedule
SELECT cron.schedule(
  'send_daily_report_reminders_tue_fri',
  '0 13 * * 2-5', -- Tuesday-Friday at 1 PM UTC (8 AM EST)
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
