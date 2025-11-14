/*
  # Add Login Rate Limiting

  1. New Tables
    - `login_attempts`
      - `id` (uuid, primary key)
      - `email` (text) - email attempting to login
      - `ip_address` (text) - IP address of attempt (if available)
      - `attempt_time` (timestamptz) - when the attempt occurred
      - `successful` (boolean) - whether the attempt succeeded
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `login_attempts` table
    - Only admins can view login attempts
    - Automatic cleanup of old attempts (older than 24 hours)
  
  3. Purpose
    - Track login attempts to prevent brute force attacks
    - Allow monitoring of suspicious login activity
    - Provide data for rate limiting logic
*/

-- Create login_attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  attempt_time timestamptz DEFAULT now(),
  successful boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time 
  ON login_attempts(email, attempt_time DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at 
  ON login_attempts(created_at);

-- Enable RLS
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins and super admins can view login attempts
CREATE POLICY "Admins can view login attempts"
  ON login_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Create function to clean up old login attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM login_attempts
  WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Note: The actual rate limiting logic will be implemented in the frontend
-- This table provides the data needed to track and monitor attempts
