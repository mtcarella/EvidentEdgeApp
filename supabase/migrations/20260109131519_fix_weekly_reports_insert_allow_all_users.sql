/*
  # Fix Weekly Reports Insert Policy - Allow All Users

  1. Changes
    - Update the INSERT policy for weekly_performance_reports
    - Allow super_admins and admins to insert reports for any processor
    - Allow ANY authenticated user in sales_people to insert their own reports
      (not just specific roles, since any role can have requires_weekly_reports or requires_daily_reports set)
  
  2. Security
    - Super admins and admins can insert reports for any processor
    - All authenticated users in sales_people can insert their own reports (processor_id = auth.uid())
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can insert reports" ON public.weekly_performance_reports;

-- Create new policy that allows all authenticated sales_people users to insert their own reports
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
    -- Any user in sales_people can insert their own report
    (
      processor_id = (select auth.uid()) AND
      EXISTS (
        SELECT 1 FROM sales_people
        WHERE id = (select auth.uid())
      )
    )
  );
