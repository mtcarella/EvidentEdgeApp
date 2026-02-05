/*
  # Fix Sales People Update Policy for Super Admin Role

  ## Changes Made
  
  1. **Fix RLS Policy to Use role Column**
     - Replace all references to `is_super_admin` column with `role = 'super_admin'`
     - The system uses the role column with value 'super_admin', not a separate boolean column
  
  ## Security Notes
  - Super admins (role = 'super_admin') can update anyone
  - Users can update their own profile
  - Regular admins and processors can update non-super-admin users
  - Nobody except super admins can modify super admin accounts
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update profile" ON sales_people;

-- Create corrected update policy using role column
CREATE POLICY "Users can update profile"
  ON sales_people FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update anyone
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.role = 'super_admin'
    )
    OR
    -- Users can update their own profile
    user_id = auth.uid()
    OR
    -- Regular admins and processors can update non-super-admin users
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.user_id = auth.uid()
        AND sp.role IN ('admin', 'processor')
      )
      AND role != 'super_admin'
    )
  )
  WITH CHECK (
    -- Super admins can set any values
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.role = 'super_admin'
    )
    OR
    -- Users updating their own profile (can't elevate to super_admin unless already super_admin)
    (
      user_id = auth.uid()
      AND (
        -- If the user is already a super admin, they can keep that role
        (SELECT sp.role FROM sales_people sp WHERE sp.user_id = auth.uid()) = 'super_admin'
        OR
        -- Otherwise, they can't set themselves to super_admin
        role != 'super_admin'
      )
    )
    OR
    -- Regular admins and processors can update non-super-admin users but can't grant super_admin
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.user_id = auth.uid()
        AND sp.role IN ('admin', 'processor')
      )
      AND role != 'super_admin'
    )
  );
