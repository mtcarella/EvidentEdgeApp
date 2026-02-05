/*
  # Create Webhook for New User Signups

  ## Changes Made

  ### 1. Database Webhook
    - Create a webhook that triggers when a new user is inserted into auth.users
    - The webhook calls the notify-new-user edge function
    - This will send an email notification to the admin

  ## Notes
    - The webhook uses the Supabase pg_net extension
    - Requires RESEND_API_KEY to be configured in Supabase dashboard
    - Requires ADMIN_EMAIL to be configured (defaults to admin@evidenttitle.com)
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to notify about new user signups
CREATE OR REPLACE FUNCTION notify_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url text;
  service_role_key text;
BEGIN
  -- Get the Supabase URL and service role key from environment
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-new-user';
  service_role_key := current_setting('app.settings.supabase_service_role_key', true);

  -- Make async HTTP request to edge function
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_user_signup_notify ON auth.users;
CREATE TRIGGER on_user_signup_notify
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_user_signup();
