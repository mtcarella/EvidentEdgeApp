/*
  # Fix Assignments INSERT Policy to Include All Roles

  1. Problem
    - Current INSERT policy only allows admin, super_admin, and processor roles
    - Salesperson and closer roles cannot create assignments
    - This blocks legitimate assignment operations

  2. Solution
    - Update the "Admins can insert any assignment" policy to include all roles
    - This allows any authenticated sales_people user to create assignments
    
  3. Security
    - All authenticated users in sales_people table can create assignments
    - Users still need to be in the sales_people table (authenticated and authorized)
    - The second policy still requires assigned_by = auth.uid() as a fallback
*/

-- Drop and recreate the admin insert policy to include all roles
DROP POLICY IF EXISTS "Admins can insert any assignment" ON assignments;

CREATE POLICY "Sales people can insert assignments"
  ON assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );
