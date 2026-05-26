/*
  # Fix verified wires insert policy to include super_admin

  1. Security Changes
    - Update the INSERT policy on `verified_wires` to also allow
      `super_admin` role, which was previously excluded.
*/

DROP POLICY IF EXISTS "Admins and processors can insert verified wires" ON verified_wires;

CREATE POLICY "Admins processors and super admins can insert verified wires"
  ON verified_wires FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('admin', 'processor', 'super_admin')
    )
  );
