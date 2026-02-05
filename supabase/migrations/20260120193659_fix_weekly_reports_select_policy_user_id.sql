/*
  # Fix Weekly Reports SELECT Policy

  ## Issue
  The SELECT policy for weekly_performance_reports was checking `sales_people.id = auth.uid()`
  but should check `sales_people.user_id = auth.uid()` because:
  - `sales_people.id` is the primary key (UUID)
  - `sales_people.user_id` is the foreign key that references auth.users
  - `auth.uid()` returns the authenticated user's ID from auth.users

  ## Changes
  - Drop the existing "Users can view reports" policy
  - Recreate it with the correct user_id comparison
  - Now super_admins, admins, sales_processors, and closers can view all reports
  - Processors can view reports where processor_id matches their sales_people.id
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view reports" ON weekly_performance_reports;

-- Create the corrected policy
CREATE POLICY "Users can view reports"
  ON weekly_performance_reports FOR SELECT
  TO authenticated
  USING (
    -- Processors can view reports where processor_id matches their sales_people.id
    processor_id IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
    OR
    -- Admins, super_admins, sales_processors, and closers can view all reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'sales_processor', 'closer')
      AND is_active = true
    )
  );
