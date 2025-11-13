/*
  # Fix Verified Wires RLS Policies

  1. Changes
    - Drop existing incorrect policies
    - Recreate policies with correct user_id check
    - The policies were checking sales_people.id = auth.uid()
    - They should check sales_people.user_id = auth.uid()
    
  2. Security
    - Admins and processors can view all verified wires
    - Admins and processors can insert new verified wires
    - Only admins can view verification logs
*/

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Admins and processors can view verified wires" ON verified_wires;
DROP POLICY IF EXISTS "Admins and processors can insert verified wires" ON verified_wires;
DROP POLICY IF EXISTS "Admins can view all verification logs" ON wire_verification_logs;
DROP POLICY IF EXISTS "Authenticated users can create verification logs" ON wire_verification_logs;

-- Recreate correct policies for verified_wires
CREATE POLICY "Admins and processors can view verified wires"
  ON verified_wires FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
  );

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

-- Recreate correct policies for wire_verification_logs
CREATE POLICY "Admins can view all verification logs"
  ON wire_verification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can create verification logs"
  ON wire_verification_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
  );
