/*
  # Fix meetings policies for salesperson role

  1. Changes
    - Update meetings policies to use 'salesperson' and 'closer' instead of 'user'
    - The role was renamed from 'user' to 'salesperson' but policies were not updated

  2. Security
    - Admins and super_admins can update/delete any meeting
    - Salespersons, closers, and processors can only update/delete meetings they created
*/

DROP POLICY IF EXISTS "Users can update meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete meetings" ON meetings;

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
    -- Salespersons, closers, and processors can only update their own meetings
    (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('salesperson', 'closer', 'processor')
      )
    )
  )
  WITH CHECK (
    -- Same rules for updating
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
        AND sales_people.role IN ('salesperson', 'closer', 'processor')
      )
    )
  );

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
    -- Salespersons, closers, and processors can only delete their own meetings
    (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('salesperson', 'closer', 'processor')
      )
    )
  );
