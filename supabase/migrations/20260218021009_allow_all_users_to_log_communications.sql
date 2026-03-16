/*
  # Allow All Users to Log Communications

  ## Problem
  The current RLS policy on `communication_logs` only allows admins and super_admins
  to insert communication logs. This prevents regular users from logging their emails
  and SMS messages when using the ViewCommunications component.

  ## Changes
  1. Drop the existing restrictive INSERT policy
  2. Create a new policy that allows all authenticated users to log their own communications
  3. Keep SELECT policies restrictive (admins see all, users see their own)

  ## Security
  - Users can only insert logs where they are the sender (sent_by = auth.uid())
  - Admins can still view all logs
  - Regular users can only view logs where they are sender or recipient
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Admins can create communication logs" ON communication_logs;

-- Allow all authenticated users to log their own communications
CREATE POLICY "Users can log their own communications"
ON communication_logs FOR INSERT
TO authenticated
WITH CHECK (sent_by = auth.uid());

-- Add policy for non-admins to view their own communications
CREATE POLICY "Users can view their own communications"
ON communication_logs FOR SELECT
TO authenticated
USING (
  -- User is the sender OR user is in the recipient list
  sent_by = auth.uid() 
  OR 
  recipient_ids @> jsonb_build_array(auth.uid()::text)
);
