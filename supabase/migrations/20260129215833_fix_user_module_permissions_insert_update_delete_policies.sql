/*
  # Fix user_module_permissions INSERT, UPDATE, DELETE policies

  1. Problem
    - The INSERT, UPDATE, and DELETE policies are checking `sales_people.id = auth.uid()`
    - They should be checking `sales_people.user_id = auth.uid()`
    - The `id` column is the primary key in sales_people table
    - The `user_id` column is the foreign key to auth.users

  2. Solution
    - Drop the incorrect INSERT, UPDATE, DELETE policies
    - Create correct policies that properly join through sales_people table
    - Only admins and super_admins should be able to modify permissions
*/

-- Drop the incorrect policies
DROP POLICY IF EXISTS "Admins can insert module permissions" ON user_module_permissions;
DROP POLICY IF EXISTS "Admins can update module permissions" ON user_module_permissions;
DROP POLICY IF EXISTS "Admins can delete module permissions" ON user_module_permissions;

-- Create the correct INSERT policy
CREATE POLICY "Admins can insert module permissions"
  ON user_module_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people 
      WHERE sales_people.user_id = auth.uid() 
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Create the correct UPDATE policy
CREATE POLICY "Admins can update module permissions"
  ON user_module_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people 
      WHERE sales_people.user_id = auth.uid() 
      AND sales_people.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people 
      WHERE sales_people.user_id = auth.uid() 
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Create the correct DELETE policy
CREATE POLICY "Admins can delete module permissions"
  ON user_module_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people 
      WHERE sales_people.user_id = auth.uid() 
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );
