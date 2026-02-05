/*
  # Add Closer Role to Weekly Reports Access

  1. Changes
    - Allow users with "closer" role to submit their own weekly reports
    - Allow users with "closer" role to update their own weekly reports
    - Maintain existing access for processors, sales_processors, admins, and super_admins

  2. Security
    - Closers can only manage their own reports (same as processors)
    - Admins and super_admins can manage any report
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Processors and admins can insert reports" ON weekly_performance_reports;
DROP POLICY IF EXISTS "Processors and admins can update reports" ON weekly_performance_reports;

-- Processors, sales_processors, closers, and admins can insert reports
CREATE POLICY "Processors and admins can insert reports"
  ON weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Processors, sales_processors, and closers can insert their own reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role IN ('processor', 'sales_processor', 'closer')
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

-- Processors, sales_processors, closers can update their own reports, admins can update any report
CREATE POLICY "Processors and admins can update reports"
  ON weekly_performance_reports FOR UPDATE
  TO authenticated
  USING (
    -- Processors, sales_processors, and closers can update their own reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role IN ('processor', 'sales_processor', 'closer')
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
    -- Processors, sales_processors, and closers can only update to their own processor_id
    (
      EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.id = weekly_performance_reports.processor_id
        AND sales_people.user_id = auth.uid()
        AND sales_people.role IN ('processor', 'sales_processor', 'closer')
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
