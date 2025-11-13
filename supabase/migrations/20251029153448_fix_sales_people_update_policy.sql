/*
  # Fix Sales People Update Policy

  ## Changes Made
  
  1. **Fix RLS Policy for User Updates**
     - Corrected the policy to check `user_id` instead of `id` when comparing with `auth.uid()`
     - The issue was that the policy was comparing the sales_people.id (UUID) with auth.uid() (user's auth ID)
     - These are different columns - we need to compare sales_people.user_id with auth.uid()
  
  ## Security Notes
  - Super admins can update anyone
  - Users can update their own profile
  - Regular admins and processors can update non-super-admin users
  - Nobody except super admins can modify super admin accounts
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update profile" ON sales_people;

-- Create corrected update policy
CREATE POLICY "Users can update profile"
  ON sales_people FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update anyone
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = (SELECT auth.uid())
      AND sp.is_super_admin = true
    )
    OR
    -- Users can update their own profile
    user_id = (SELECT auth.uid())
    OR
    -- Regular admins and processors can update non-super-admin users
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.user_id = (SELECT auth.uid())
        AND sp.role IN ('admin', 'processor')
      )
      AND NOT EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.id = sales_people.id
        AND sp.is_super_admin = true
      )
    )
  )
  WITH CHECK (
    -- Super admins can set any values
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = (SELECT auth.uid())
      AND sp.is_super_admin = true
    )
    OR
    -- Users updating their own profile
    (
      user_id = (SELECT auth.uid())
      AND (
        -- If the user is a super admin, they can change their own super_admin status
        (SELECT sp.is_super_admin FROM sales_people sp WHERE sp.user_id = (SELECT auth.uid())) = true
        OR
        -- Otherwise, they can't change their super_admin status
        is_super_admin = (SELECT sp.is_super_admin FROM sales_people sp WHERE sp.id = sp.id)
      )
    )
    OR
    -- Regular admins and processors can update non-super-admin users but can't grant super_admin
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.user_id = (SELECT auth.uid())
        AND sp.role IN ('admin', 'processor')
      )
      AND NOT EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.id = sales_people.id
        AND sp.is_super_admin = true
      )
      AND is_super_admin = false
    )
  );
