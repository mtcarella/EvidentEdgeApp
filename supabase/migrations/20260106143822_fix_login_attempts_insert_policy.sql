/*
  # Fix Login Attempts Insert Policy

  1. Changes
    - Add INSERT policy for login_attempts table
    - Allow anyone (authenticated or not) to insert login attempts
    - This is necessary for the login flow to work properly

  2. Security
    - Users can only insert records, not read them
    - Only admins can view login attempts (existing SELECT policy)
    - This allows tracking of login attempts without exposing sensitive data

  3. Purpose
    - Fix the blank screen issue when users try to log in
    - Enable proper logging of login attempts for security monitoring
*/

-- Allow anyone to insert login attempts (needed for the login flow to work)
CREATE POLICY "Anyone can insert login attempts"
  ON public.login_attempts FOR INSERT
  WITH CHECK (true);
