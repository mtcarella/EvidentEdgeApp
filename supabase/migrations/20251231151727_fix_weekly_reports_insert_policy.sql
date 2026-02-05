/*
  # Fix Weekly Performance Reports Insert Policy

  1. Changes
    - Drop the restrictive insert policy that only allowed 'processor' role
    - Create a new insert policy that allows processors, sales_processor, admins, and super_admins to submit reports
    
  2. Reasoning
    - The form is accessible to all processor-level roles (processor, sales_processor) and admin roles
    - Users should be able to submit reports for themselves regardless of whether they are a processor or admin
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Processors can insert own reports" ON weekly_performance_reports;

-- Create a new policy that allows processors, sales_processor, admins, and super_admins to insert reports
CREATE POLICY "Authorized users can insert reports"
  ON weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role IN ('processor', 'sales_processor', 'admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );
