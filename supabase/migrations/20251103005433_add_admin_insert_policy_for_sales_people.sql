/*
  # Add admin insert policy for sales_people

  1. Changes
    - Add policy allowing admins and super_admins to insert new sales_people records
    - This enables admins to create new user accounts from the Admin Panel
  
  2. Security
    - Only users with admin or super_admin role can insert new salespeople
    - Maintains existing security for non-admin users
*/

-- Add policy for admins to insert new users
CREATE POLICY "Admins can insert salespeople"
  ON sales_people
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND (sp.role = 'admin' OR sp.is_super_admin = true)
    )
  );