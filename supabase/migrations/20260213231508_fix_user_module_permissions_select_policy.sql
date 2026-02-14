/*
  # Fix user_module_permissions SELECT policy
  
  1. Changes
    - Drop the incorrect SELECT policy that checks user_id = auth.uid()
    - Create a new SELECT policy that properly checks if the user owns the permissions
      by joining with sales_people table to match auth.uid() with user_id
  
  2. Security
    - Users can only view their own module permissions
    - Admins and super_admins can view all module permissions
*/

-- Drop the existing incorrect policy
DROP POLICY IF EXISTS "Users can view module permissions" ON user_module_permissions;

-- Create the correct policy that checks via sales_people table
CREATE POLICY "Users can view own module permissions"
  ON user_module_permissions
  FOR SELECT
  TO authenticated
  USING (
    -- User is viewing their own permissions (user_id matches their sales_people.id)
    user_id IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
    OR
    -- User is an admin or super_admin
    EXISTS (
      SELECT 1 FROM sales_people 
      WHERE sales_people.user_id = auth.uid() 
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );
