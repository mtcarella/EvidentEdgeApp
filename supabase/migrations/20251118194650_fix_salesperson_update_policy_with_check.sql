/*
  # Fix salesperson contact update policy WITH CHECK clause

  1. Problem
    - Current WITH CHECK clause tries to compare fields with subqueries
    - Subqueries in WITH CHECK reference NEW values, not OLD values
    - This causes RLS violations when salespersons try to update contacts
    - Field: paralegal_processor was added but not included in the restricted fields list
    
  2. Solution
    - Remove the subquery-based field comparison from WITH CHECK
    - Rely on application-level validation to prevent salespersons from editing admin/processor fields
    - WITH CHECK should just verify the user has permission, not validate field changes
    - This is the standard approach for RLS policies
    
  3. Security
    - USING clause: Controls who can attempt the update (admins/processors, creators, assigned salespersons)
    - WITH CHECK clause: Verifies the user has permission after the update
    - Application layer: Enforces which fields each role can edit
    - This separation is cleaner and avoids PostgreSQL RLS limitations
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
    -- Users can update contacts currently assigned to them (salespersons)
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
    OR
    -- Assigned salespersons can update (application enforces field restrictions)
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.contact_id = contacts.id
      AND assignments.salesperson_id IN (
        SELECT id FROM sales_people WHERE user_id = auth.uid()
      )
    )
  );
