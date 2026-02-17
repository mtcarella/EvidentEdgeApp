/*
  # Fix Login Attempts RLS Policy

  1. Problem
    - The existing INSERT policy "Insert login attempts for tracking" requires ip_address to be NOT NULL and have length > 0
    - The LoginForm component doesn't provide ip_address when logging attempts
    - This causes RLS policy violations and prevents login attempts from being recorded
    - Results in 403 errors and blank screen on login

  2. Changes
    - Drop the existing restrictive INSERT policy
    - Create a new permissive INSERT policy that only requires email
    - Allow authenticated and anonymous users to insert login attempts
    - IP address is now optional (can be null)

  3. Security
    - Users can only INSERT records, not read them
    - Only admins can view login attempts (existing SELECT policy unchanged)
    - Email validation still required to prevent spam
    - This maintains security while fixing the login flow
*/

-- Drop the existing restrictive policy if it exists
DROP POLICY IF EXISTS "Insert login attempts for tracking" ON public.login_attempts;
DROP POLICY IF EXISTS "Anyone can insert login attempts" ON public.login_attempts;

-- Create new permissive policy that allows inserts with just email
CREATE POLICY "Allow login attempt tracking"
  ON public.login_attempts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL 
    AND length(email) > 0
  );
