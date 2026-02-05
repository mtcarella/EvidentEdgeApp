/*
  # Fix Reminder Timing - Send Day After Due Date

  ## Issue
  Reminders are currently being sent on the morning reports are due, but they should be sent
  the morning AFTER reports are due (when they're overdue).

  ## Changes
  - Update daily report reminder cron from Tuesday-Friday to Wednesday-Saturday
    - This sends reminders the day after daily reports are due (Mon-Thu)

  - Update weekly report reminder cron from Monday to Tuesday
    - This sends reminders the day after weekly reports are due (Monday)

  ## Schedule
  - Daily reports due: Monday-Thursday
  - Daily reminders sent: Wednesday-Saturday 8 AM EST (day after due)

  - Weekly reports due: Monday
  - Weekly reminders sent: Tuesday 8 AM EST (day after due)
*/

-- Drop and recreate daily report reminder cron job
SELECT cron.unschedule('send_daily_report_reminders_tue_fri');

SELECT cron.schedule(
  'send_daily_report_reminders_wed_sat',
  '0 13 * * 3-6', -- Wednesday-Saturday at 1 PM UTC (8 AM EST)
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

-- Drop and recreate weekly report reminder cron job
SELECT cron.unschedule('send_weekly_report_reminders_monday');

SELECT cron.schedule(
  'send_weekly_report_reminders_tuesday',
  '0 13 * * 2', -- Tuesday at 1 PM UTC (8 AM EST)
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
