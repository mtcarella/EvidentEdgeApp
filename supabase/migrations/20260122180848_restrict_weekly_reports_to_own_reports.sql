/*
  # Restrict Weekly Reports to Own Reports Only
  
  ## Changes
  - Update SELECT policy for weekly_performance_reports
  - Non-admin users can now ONLY view their own reports
  - Admins and super_admins can still view all reports
  
  ## Security
  - Removes viewing access to all reports for sales_processor, closer, and other roles
  - Each user can only see reports where processor_id matches their sales_people.id
  - Only admin and super_admin roles can view all reports
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view reports" ON weekly_performance_reports;

-- Create the new restricted policy
CREATE POLICY "Users can view reports"
  ON weekly_performance_reports FOR SELECT
  TO authenticated
  USING (
    -- Users can view reports where processor_id matches their sales_people.id
    processor_id IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
    OR
    -- Only admins and super_admins can view all reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );
