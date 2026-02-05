/*
  # Fix Weekly Performance Reports Select Policy

  1. Changes
    - Drop the existing select policy
    - Create a new select policy that:
      - Allows admins and super_admins to view all reports
      - Allows all other users (processors, sales_processor, etc.) to only view their own reports

  2. Security
    - Ensures data isolation for non-admin users
    - Only admins and super_admins have full visibility
    - All other roles can only see reports they created
*/

-- Drop existing select policy
DROP POLICY IF EXISTS "Users can view reports based on role" ON weekly_performance_reports;

-- Create new policy with proper role-based filtering
CREATE POLICY "Users can view reports based on role"
  ON weekly_performance_reports FOR SELECT
  TO authenticated
  USING (
    -- Admins and super_admins can view all reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
    OR
    -- All other users can only view their own reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.is_active = true
    )
  );
