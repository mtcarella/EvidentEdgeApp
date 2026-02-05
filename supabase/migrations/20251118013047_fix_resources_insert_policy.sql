/*
  # Fix resources insert policy

  1. Changes
    - Fix the resources insert policy to use user_id instead of id
    - The policy was checking sales_people.id = auth.uid() but should be user_id = auth.uid()
    - Also fix the delete policy for consistency

  2. Security
    - Only admins and super_admins can insert resources
    - Only admins and super_admins can delete resources
*/

DROP POLICY IF EXISTS "Admins can insert resources" ON resources;
DROP POLICY IF EXISTS "Admins can delete resources" ON resources;

-- Admins and super_admins can insert resources
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

-- Admins and super_admins can delete resources
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
