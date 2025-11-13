/*
  # Add UPDATE and DELETE policies for verified_wires table

  1. Changes
    - Add UPDATE policy for super_admin role
    - Add DELETE policy for super_admin role

  2. Security
    - Only super_admin users can update verified wires
    - Only super_admin users can delete verified wires
    - These policies enable the Manage tab functionality
*/

-- Allow super_admin to update verified wires
CREATE POLICY "Super admins can update verified wires"
  ON verified_wires
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
    )
  );

-- Allow super_admin to delete verified wires
CREATE POLICY "Super admins can delete verified wires"
  ON verified_wires
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
    )
  );
