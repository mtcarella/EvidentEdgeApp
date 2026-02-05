/*
  # Fix Resources Table Policies Consistency

  1. Changes
    - Fix all policies to consistently use user_id instead of id
    - Add is_active check to INSERT and DELETE policies for consistency
    - Ensures all policies check the correct column (user_id) which references auth.users

  2. Security
    - All policies now consistently check user_id = auth.uid()
    - All policies verify user is active
    - Maintains admin and super_admin access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert resources" ON resources;
DROP POLICY IF EXISTS "Admins can delete resources" ON resources;
DROP POLICY IF EXISTS "Admins can update resources" ON resources;

-- Recreate INSERT policy with correct column
CREATE POLICY "Admins can insert resources"
  ON resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Recreate DELETE policy with correct column
CREATE POLICY "Admins can delete resources"
  ON resources
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Recreate UPDATE policy (already correct, but ensuring consistency)
CREATE POLICY "Admins can update resources"
  ON resources
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );
