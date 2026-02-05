/*
  # Update Weekly Reports Policy to Include sales_processor Role

  1. Changes
    - Update INSERT policy to allow sales_processor role to insert their own reports
    - Update UPDATE policy to allow sales_processor role to update their own reports
    - Maintain existing admin and super_admin capabilities

  2. Security
    - sales_processor can only manage their own reports
    - admins and super_admins can manage any report
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Processors and admins can insert reports" ON weekly_performance_reports;
DROP POLICY IF EXISTS "Processors and admins can update reports" ON weekly_performance_reports;

-- Processors, sales_processors, and admins can insert reports
CREATE POLICY "Processors and admins can insert reports"
  ON weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Processors and sales_processors can insert their own reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role IN ('processor', 'sales_processor')
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

-- Processors, sales_processors can update their own reports, admins can update any report
CREATE POLICY "Processors and admins can update reports"
  ON weekly_performance_reports FOR UPDATE
  TO authenticated
  USING (
    -- Processors and sales_processors can update their own reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role IN ('processor', 'sales_processor')
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
    -- Processors and sales_processors can only update to their own processor_id
    (
      EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.id = weekly_performance_reports.processor_id
        AND sales_people.user_id = auth.uid()
        AND sales_people.role IN ('processor', 'sales_processor')
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
