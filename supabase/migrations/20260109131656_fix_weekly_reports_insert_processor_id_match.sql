/*
  # Fix Weekly Reports Insert Policy - Correct processor_id Matching

  1. Changes
    - Update the INSERT policy for weekly_performance_reports
    - Fix the processor_id check to properly match sales_people.id with auth.uid()
    - processor_id is sales_people.id, but auth.uid() returns the user_id
    - So we need to check: processor_id = (SELECT id FROM sales_people WHERE user_id = auth.uid())
  
  2. Security
    - Super admins and admins can insert reports for any processor
    - All authenticated users in sales_people can insert their own reports
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can insert reports" ON public.weekly_performance_reports;

-- Create new policy with correct processor_id matching
CREATE POLICY "Users can insert reports"
  ON public.weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins and admins can insert reports for any processor
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
    OR
    -- Any authenticated user can insert their own report (processor_id must match their sales_people.id)
    processor_id IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
  );
