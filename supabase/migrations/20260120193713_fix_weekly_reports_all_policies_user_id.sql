/*
  # Fix All Weekly Reports RLS Policies

  ## Issue
  Multiple policies were using `sales_people.id = auth.uid()` instead of 
  `sales_people.user_id = auth.uid()`. This affected INSERT, UPDATE, and DELETE policies.

  ## Changes
  - Fix INSERT policy to use user_id correctly
  - Fix UPDATE policy to use user_id correctly  
  - Fix DELETE policy to use user_id correctly
*/

-- Fix INSERT policy
DROP POLICY IF EXISTS "Users can insert reports" ON weekly_performance_reports;

CREATE POLICY "Users can insert reports"
  ON weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins and super_admins can insert reports for anyone
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
    OR
    -- Users can insert reports where processor_id matches their sales_people.id
    processor_id IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
  );

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Users can update reports" ON weekly_performance_reports;

CREATE POLICY "Users can update reports"
  ON weekly_performance_reports FOR UPDATE
  TO authenticated
  USING (
    -- Users can update reports where processor_id matches their sales_people.id
    processor_id IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
    OR
    -- Admins and super_admins can update any report
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  )
  WITH CHECK (
    -- Users can update reports where processor_id matches their sales_people.id
    processor_id IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
    OR
    -- Admins and super_admins can update any report
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Fix DELETE policy
DROP POLICY IF EXISTS "Admins can delete reports" ON weekly_performance_reports;

CREATE POLICY "Admins can delete reports"
  ON weekly_performance_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );
