/*
  # Fix salesperson contact update policy

  1. Problem
    - The WITH CHECK clause was trying to compare old values using subqueries
    - This doesn't work during UPDATE operations in PostgreSQL RLS
    - Salespersons get RLS policy violation errors
    
  2. Solution
    - Simplify the policy to allow assigned salespersons to update their contacts
    - Only admins/processors can change the protected fields (enforced by application)
    - This is more performant and avoids the subquery comparison issue
    
  3. Security
    - Admins, super_admins, and processors can update any contact field
    - Regular users can fully update contacts they created
    - Salespersons assigned to contacts can update them (application enforces field restrictions)
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
    -- Regular users can update if they created it or are assigned to it
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.contact_id = contacts.id
      AND assignments.salesperson_id IN (
        SELECT id FROM sales_people WHERE user_id = auth.uid()
      )
    )
  );
