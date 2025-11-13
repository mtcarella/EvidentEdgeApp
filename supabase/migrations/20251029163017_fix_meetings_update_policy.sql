/*
  # Fix meetings update policy

  1. Changes
    - Update the meetings update policy to correctly check created_by against auth.uid()
    - Previously was checking against sales_people.id which is incorrect since created_by references auth.users.id

  2. Security
    - Admins and super_admins can update any meeting
    - Processors and regular users can only update meetings they created
*/

DROP POLICY IF EXISTS "Users can update meetings" ON meetings;

CREATE POLICY "Users can update meetings"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (
    -- Admins and super_admins can update any meeting
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
    OR
    -- Users and processors can only update their own meetings
    (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('processor', 'user')
      )
    )
  )
  WITH CHECK (
    -- Same rules for inserting/updating
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
    OR
    (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('processor', 'user')
      )
    )
  );
