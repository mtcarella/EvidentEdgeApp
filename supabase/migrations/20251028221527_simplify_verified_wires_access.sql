/*
  # Simplify Verified Wires Access

  1. Changes
    - Drop existing restrictive policies
    - Allow all authenticated users to view verified wires (read-only for searches)
    - Keep insert restricted to admins and processors only
    
  2. Reasoning
    - All users need to verify wires as part of their job
    - The verification search should be available to everyone
    - Only adding new wires should be restricted
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and processors can view verified wires" ON verified_wires;
DROP POLICY IF EXISTS "Admins and processors can insert verified wires" ON verified_wires;

-- Allow all authenticated users to view verified wires
CREATE POLICY "Authenticated users can view verified wires"
  ON verified_wires FOR SELECT
  TO authenticated
  USING (true);

-- Only admins and processors can insert new verified wires
CREATE POLICY "Admins and processors can insert verified wires"
  ON verified_wires FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
  );
