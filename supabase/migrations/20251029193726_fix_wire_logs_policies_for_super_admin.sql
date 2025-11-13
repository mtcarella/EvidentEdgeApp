/*
  # Fix wire verification logs policies for super_admin

  1. Changes
    - Update SELECT policy to include super_admin role
    - This allows super_admins to view verification logs

  2. Security
    - Maintains existing admin access
    - Adds super_admin access to logs
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can view all verification logs" ON wire_verification_logs;

-- Create new policy with super_admin included
CREATE POLICY "Admins and super_admins can view all verification logs"
  ON wire_verification_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );
