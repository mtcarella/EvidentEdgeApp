/*
  # Fix Delete Policy User ID Reference

  1. Changes
    - Fix the "Users can update profile" policy to use user_id instead of id when comparing with auth.uid()
    - Fix the "Admins can delete salespeople" policy to use user_id instead of id when comparing with auth.uid()
    
  2. Security
    - This fixes the issue where admins couldn't delete users because the policy was checking the wrong column
    - The id column is the sales_people record ID, not the auth user ID
    - The user_id column is the correct reference to auth.users.id
*/

-- Drop the existing update policy
DROP POLICY IF EXISTS "Users can update profile" ON sales_people;

-- Create new update policy with corrected user_id references
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
    -- Super admins can update anyone
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = (SELECT auth.uid())
      AND sp.is_super_admin = true
    )
    OR
    -- Users can update their own profile except super admin status
    (
      user_id = (SELECT auth.uid())
      AND (
        -- Only super admins can modify super admin status
        (
          SELECT is_super_admin 
          FROM sales_people sp 
          WHERE sp.user_id = (SELECT auth.uid())
        ) = true
        OR
        -- Non-super admins cannot change their super admin status
        is_super_admin = (
          SELECT sp.is_super_admin 
          FROM sales_people sp 
          WHERE sp.id = sales_people.id
        )
      )
    )
    OR
    -- Regular admins and processors can update non-super-admin users (but not their super admin status)
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

-- Drop the existing delete policy
DROP POLICY IF EXISTS "Admins can delete salespeople" ON sales_people;

-- Create new delete policy with corrected user_id references
CREATE POLICY "Admins can delete salespeople"
  ON sales_people FOR DELETE
  TO authenticated
  USING (
    -- Super admins can delete anyone except themselves
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.user_id = (SELECT auth.uid())
        AND sp.is_super_admin = true
      )
      AND sales_people.user_id != (SELECT auth.uid())
    )
    OR
    -- Regular admins can delete non-super-admin users
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.user_id = (SELECT auth.uid())
        AND sp.role = 'admin'
      )
      AND NOT EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.id = sales_people.id
        AND sp.is_super_admin = true
      )
    )
  );
