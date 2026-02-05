/*
  # Setup Monday Morning Email Reminder Cron Job

  1. Extension Setup
    - Enable pg_net extension for HTTP requests from database
    
  2. Function
    - `trigger_reminder_emails()` - Makes HTTP request to edge function
    
  3. Scheduled Job
    - Monday 8am Eastern (Monday 1pm UTC during EST, Monday 12pm UTC during EDT)
      - Calls the send-report-reminders edge function
      
  4. Notes
    - Requires pg_net extension to make HTTP requests from database
    - Edge function URL will be constructed from SUPABASE_URL environment variable
    - Service role key will be used for authentication
*/

-- Enable pg_net extension for HTTP requests
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net extension could not be enabled. You may need to enable it manually.';
END $$;

-- Function to trigger reminder emails by calling the edge function
CREATE OR REPLACE FUNCTION trigger_reminder_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  edge_function_url text;
BEGIN
  -- Get the Supabase URL from environment or construct it
  -- Note: In production, this would typically be set via environment variables
  -- For now, we'll use a placeholder that needs to be updated
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE NOTICE 'Supabase URL not configured. Please set app.settings.supabase_url';
    RETURN;
  END IF;
  
  edge_function_url := supabase_url || '/functions/v1/send-report-reminders';
  
  -- Make HTTP POST request to edge function
  -- Note: This requires pg_net extension and appropriate permissions
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  
  RAISE NOTICE 'Reminder email trigger sent to edge function';
  
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to trigger reminder emails: %', SQLERRM;
END;
$$;

-- Schedule: Send reminder emails every Monday at 8am Eastern (Monday 1pm UTC)
-- Cron: '0 13 * * 1' = At 1:00 PM UTC on Monday (Monday 8am EST)
DO $$
BEGIN
  -- Remove existing job if it exists
  PERFORM cron.unschedule('send_reminder_emails');
  EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'send_reminder_emails',
    '0 13 * * 1',
    'SELECT trigger_reminder_emails();'
  );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule send_reminder_emails job. pg_cron may not be available.';
END $$;

-- Set the Supabase URL configuration (this should be updated with your actual URL)
-- Note: This is a placeholder and should be configured in your Supabase dashboard
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';