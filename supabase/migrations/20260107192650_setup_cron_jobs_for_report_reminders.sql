/*
  # Setup Cron Jobs for Performance Report Reminders

  1. Extension Setup
    - Enable pg_cron extension (if available)
    
  2. Scheduled Jobs
    - Friday 8pm Eastern (Saturday 1am UTC during EST, Saturday 12am UTC during EDT)
      - Check for missing reports and create reminder records
    - Monday 8am Eastern (Monday 1pm UTC during EST, Monday 12pm UTC during EDT)
      - Trigger edge function to send reminder emails
      
  3. Notes
    - Timezone: Eastern Time is UTC-5 (EST) or UTC-4 (EDT)
    - Using EST times (UTC-5) as baseline:
      * Friday 8pm EST = Saturday 1am UTC
      * Monday 8am EST = Monday 1pm UTC
    - During EDT (March-November), times will be 1 hour earlier in UTC
    - If pg_cron is not available, alternative scheduling methods will be needed
    - Cron format: minute hour day-of-month month day-of-week
*/

-- Enable pg_cron extension
DO $outer$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension could not be enabled. You may need to enable it manually or use an alternative scheduling method.';
END $outer$;

-- Schedule: Check for missing reports every Friday at 8pm Eastern (Saturday 1am UTC)
-- Cron: '0 1 * * 6' = At 1:00 AM UTC on Saturday (Friday 8pm EST)
DO $outer$
BEGIN
  -- Remove existing job if it exists
  PERFORM cron.unschedule('check_missing_performance_reports');
  EXCEPTION WHEN OTHERS THEN
    NULL;
END $outer$;

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'check_missing_performance_reports',
    '0 1 * * 6',
    'SELECT check_missing_reports();'
  );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule check_missing_performance_reports job. pg_cron may not be available.';
END $outer$;

-- Note: The email reminder job will be triggered by calling the edge function
-- This needs to be set up via an external cron service (like GitHub Actions, Render Cron, etc.)
-- or through Supabase's dashboard if webhook-based scheduling is available