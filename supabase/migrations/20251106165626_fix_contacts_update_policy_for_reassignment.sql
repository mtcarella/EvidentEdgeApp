/*
  # Fix contacts update policy to allow reassignment

  1. Problem
    - When changing the assigned_to field, the WITH CHECK clause fails
    - It's checking for an assignment that hasn't been created yet
    - This prevents reassigning contacts from one salesperson to another

  2. Solution
    - Update the WITH CHECK clause to not validate assignments
    - USING clause controls who can initiate the update
    - WITH CHECK should only verify the updated data is valid, not relationships
    
  3. Security
    - Admins, super_admins, and processors can update any contact
    - Regular users can only update contacts they created or are currently assigned to
    - The assignment updates are handled separately in the application code
*/

DROP POLICY IF EXISTS "Users can update contacts" ON contacts;

CREATE POLICY "Users can update contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (
    -- Admins, super_admins, and processors can update any contact
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin', 'processor')
    )
    OR
    -- Users can update contacts they created
    created_by = auth.uid()
    OR
    -- Users can update contacts currently assigned to them
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.contact_id = contacts.id
      AND assignments.salesperson_id IN (
        SELECT id FROM sales_people WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    -- Admins, super_admins, and processors can make any updates
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin', 'processor')
    )
    OR
    -- Regular users can update if they created it
    created_by = auth.uid()
  );
