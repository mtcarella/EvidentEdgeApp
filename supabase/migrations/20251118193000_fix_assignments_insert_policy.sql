/*
  # Fix Assignments INSERT Policy for Admins and Super Admins

  1. Problem
    - Current INSERT policy only checks that assigned_by = auth.uid()
    - Admins and super_admins should be able to create assignments freely
    - Current policy may be blocking admin assignment creation

  2. Solution
    - Drop existing INSERT policy
    - Create new INSERT policy that explicitly allows:
      - Admins (role = 'admin')
      - Super Admins (role = 'super_admin')
      - Processors (role = 'processor')
      - Regular users (where assigned_by = auth.uid())
    
  3. Security
    - Admins, super_admins, and processors can create any assignment
    - Regular users can only create assignments they're responsible for
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert assignments" ON assignments;

-- Create INSERT policy for admins, super_admins, and processors (can insert any assignment)
CREATE POLICY "Admins can insert any assignment"
  ON assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'processor')
    )
  );

-- Create INSERT policy for regular users (can insert assignments they create)
CREATE POLICY "Users can insert assignments they create"
  ON assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
  );
