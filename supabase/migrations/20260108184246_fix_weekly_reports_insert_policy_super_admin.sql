/*
  # Fix Weekly Reports Insert Policy for Super Admin

  1. Changes
    - Update the INSERT policy for weekly_performance_reports
    - Allow super_admins to insert reports for any processor
    - Keep the restriction for regular processors (they can only insert their own reports)
  
  2. Security
    - Super admins and admins can insert reports for any processor
    - Regular processors and sales_processors can only insert their own reports
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can insert reports" ON public.weekly_performance_reports;

-- Create new policy that allows super_admins to insert for any processor
CREATE POLICY "Users can insert reports"
  ON public.weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins and admins can insert reports for any processor
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
    OR
    -- Processors and sales_processors can only insert their own reports
    (
      processor_id = (select auth.uid()) AND
      EXISTS (
        SELECT 1 FROM sales_people
        WHERE id = (select auth.uid())
        AND role IN ('processor', 'sales_processor', 'closer')
      )
    )
  );
