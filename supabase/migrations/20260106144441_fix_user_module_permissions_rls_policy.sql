/*
  # Fix user_module_permissions RLS policy
  
  The SELECT policy was checking `user_id = auth.uid()`, but user_id stores the sales_people.id,
  not the auth user ID. This migration fixes the policy to properly join through sales_people.
*/

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can view module permissions" ON user_module_permissions;

-- Create the correct policy that joins through sales_people
CREATE POLICY "Users can view module permissions"
  ON user_module_permissions
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM sales_people 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );
