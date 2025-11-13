/*
  # Prevent Inactive Users from Accessing Data

  1. Changes
    - Update all SELECT policies to check that the user is active
    - This ensures inactive users cannot access any data even if they have a valid auth token

  2. Security
    - Inactive users (is_active = false) will be blocked from all operations
    - Only active users can view and manage data
*/

-- Drop existing SELECT policies that don't check is_active
DROP POLICY IF EXISTS "Authenticated users can view salespeople" ON sales_people;
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can view assignments" ON assignments;
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON audit_logs;

-- Recreate SELECT policies with is_active check
CREATE POLICY "Active users can view salespeople"
  ON sales_people FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.is_active = true
    )
  );

CREATE POLICY "Active users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.is_active = true
    )
  );

CREATE POLICY "Active users can view assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.is_active = true
    )
  );

CREATE POLICY "Active users can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.is_active = true
    )
  );