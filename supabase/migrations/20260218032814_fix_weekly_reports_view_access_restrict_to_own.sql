/*
  # Fix Weekly Reports View Access - Restrict to Own Reports

  ## Changes
  - Update SELECT policy for weekly_performance_reports
  - NON-ADMIN users can ONLY view their OWN reports (where processor_id matches their sales_people.id)
  - Only admin and super_admin roles can view ALL reports
  - Removes blanket access for processor, sales_processor, and view_daily_reports module permission holders

  ## Security
  - Enforces strict data isolation - users can only see their own performance reports
  - Only administrators (admin, super_admin) have access to view all reports
  - This ensures proper data privacy and prevents users from viewing other people's performance reports
*/

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view reports" ON weekly_performance_reports;

-- Create the new properly restricted policy
CREATE POLICY "Users can view reports"
  ON weekly_performance_reports FOR SELECT
  TO authenticated
  USING (
    -- Admins and super_admins can view all reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
    OR
    -- All other users can ONLY view their own reports
    processor_id IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
  );
