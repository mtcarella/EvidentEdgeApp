/*
  # Add Super Admin Role for Mike Carella

  1. Changes
    - Add is_super_admin boolean column to sales_people table
    - Set Mike Carella (b396f0f8-219a-4a72-88b4-4e997e0db52a) as super admin
    - Update RLS policies to allow super admins to modify any user's role
    
  2. Security
    - Super admins can update any salesperson including other admins
    - Super admin status can only be changed by super admins themselves
    - Regular admins still have admin privileges but cannot modify super admins
*/

-- Add is_super_admin column
ALTER TABLE sales_people 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Set Mike Carella as super admin
UPDATE sales_people 
SET is_super_admin = true 
WHERE id = 'b396f0f8-219a-4a72-88b4-4e997e0db52a';

-- Drop the existing update policy
DROP POLICY IF EXISTS "Users can update profile" ON sales_people;

-- Create new update policy that includes super admin logic
CREATE POLICY "Users can update profile"
  ON sales_people FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update anyone
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.id = (SELECT auth.uid())
      AND sp.is_super_admin = true
    )
    OR
    -- Users can update their own profile
    (SELECT auth.uid()) = id
    OR
    -- Regular admins and processors can update non-super-admin users
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.id = (SELECT auth.uid())
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
      WHERE sp.id = (SELECT auth.uid())
      AND sp.is_super_admin = true
    )
    OR
    -- Users can update their own profile except super admin status
    (
      (SELECT auth.uid()) = id
      AND (
        -- Only super admins can modify super admin status
        (
          SELECT is_super_admin 
          FROM sales_people sp 
          WHERE sp.id = (SELECT auth.uid())
        ) = true
        OR
        -- Non-super admins cannot change their super admin status
        is_super_admin = (
          SELECT sp.is_super_admin 
          FROM sales_people sp 
          WHERE sp.id = id
        )
      )
    )
    OR
    -- Regular admins and processors can update non-super-admin users (but not their super admin status)
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.id = (SELECT auth.uid())
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

-- Update delete policy to protect super admins
DROP POLICY IF EXISTS "Admins can delete salespeople" ON sales_people;

CREATE POLICY "Admins can delete salespeople"
  ON sales_people FOR DELETE
  TO authenticated
  USING (
    -- Super admins can delete anyone except themselves
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.id = (SELECT auth.uid())
        AND sp.is_super_admin = true
      )
      AND sales_people.id != (SELECT auth.uid())
    )
    OR
    -- Regular admins can delete non-super-admin users
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.id = (SELECT auth.uid())
        AND sp.role = 'admin'
      )
      AND NOT EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.id = sales_people.id
        AND sp.is_super_admin = true
      )
    )
  );
