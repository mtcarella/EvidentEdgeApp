/*
  # Update Admin Access for Weekly Performance Reports

  1. Changes
    - Allow admins and super_admins to update any report
    - Allow admins and super_admins to insert reports on behalf of processors
    - Allow admins (not just super_admins) to delete reports

  2. Security
    - Maintains processor access to their own reports
    - Extends full management capabilities to admins and super_admins
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Processors can insert own reports" ON weekly_performance_reports;
DROP POLICY IF EXISTS "Processors can update own reports" ON weekly_performance_reports;
DROP POLICY IF EXISTS "Super admins can delete reports" ON weekly_performance_reports;

-- Processors and admins can insert reports
CREATE POLICY "Processors and admins can insert reports"
  ON weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Processors can insert their own reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role = 'processor'
      AND sales_people.is_active = true
    ) OR
    -- Admins and super_admins can insert any report
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Processors can update their own reports, admins can update any report
CREATE POLICY "Processors and admins can update reports"
  ON weekly_performance_reports FOR UPDATE
  TO authenticated
  USING (
    -- Processors can update their own reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role = 'processor'
      AND sales_people.is_active = true
    ) OR
    -- Admins and super_admins can update any report
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  )
  WITH CHECK (
    -- Processors can only update to their own processor_id
    (
      EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.id = weekly_performance_reports.processor_id
        AND sales_people.user_id = auth.uid()
        AND sales_people.role = 'processor'
        AND sales_people.is_active = true
      )
    ) OR
    -- Admins and super_admins can update any report to any processor_id
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Admins and super admins can delete reports
CREATE POLICY "Admins and super admins can delete reports"
  ON weekly_performance_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );
