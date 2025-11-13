/*
  # Fix assignments UPDATE policy to include super_admin and processor

  1. Problem
    - Current UPDATE policies only allow 'admin' role
    - super_admin and processor roles cannot update assignments
    - This prevents reassigning contacts when logged in as super_admin or processor

  2. Solution
    - Drop existing UPDATE policies
    - Create new policies that include admin, super_admin, and processor roles
    
  3. Security
    - Admins, super_admins, and processors can update any assignment
    - Regular users can only update assignments they created
*/

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update assignments they created" ON assignments;
DROP POLICY IF EXISTS "Admins can update any assignment" ON assignments;

-- Add UPDATE policy for admins, super_admins, and processors (can update any assignment)
CREATE POLICY "Admins can update any assignment"
  ON assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'processor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'processor')
    )
  );

-- Add UPDATE policy for regular users (can update assignments they created)
CREATE POLICY "Users can update assignments they created"
  ON assignments
  FOR UPDATE
  TO authenticated
  USING (
    assigned_by = auth.uid()
  )
  WITH CHECK (
    assigned_by = auth.uid()
  );
