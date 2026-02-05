/*
  # Fix Update Policy for Weekly Performance Reports

  1. Changes
    - Drop existing update policy if it exists
    - Recreate update policy to allow processors to edit their own submissions
    
  2. Security
    - Users can only update reports where they are the processor
    - Only authorized roles (processor, sales_processor, admin, super_admin) can update
    - User must be active
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Processors can update own reports" ON weekly_performance_reports;

-- Allow processors to update their own reports
CREATE POLICY "Processors can update own reports"
  ON weekly_performance_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role IN ('processor', 'sales_processor', 'admin', 'super_admin')
      AND sales_people.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role IN ('processor', 'sales_processor', 'admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );
