/*
  # Fix meetings delete policy

  1. Changes
    - Update the meetings delete policy to correctly check created_by against auth.uid()
    - Previously was checking against sales_people.id which is incorrect since created_by references auth.users.id

  2. Security
    - Admins and super_admins can delete any meeting
    - Processors and regular users can only delete meetings they created
*/

DROP POLICY IF EXISTS "Users can delete meetings" ON meetings;

CREATE POLICY "Users can delete meetings"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (
    -- Admins and super_admins can delete any meeting
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
    OR
    -- Users and processors can only delete their own meetings
    (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('processor', 'user')
      )
    )
  );
