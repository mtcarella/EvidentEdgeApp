/*
  # Allow salespersons to edit all contact details except admin/processor fields

  1. Admin/Processor Only Fields (cannot be edited by salespersons)
    - paralegal (admin only)
    - assigned_to (admin only)
    - preferred_surveyor (admin/processor only)
    - preferred_uw (admin/processor only)
    - preferred_closer (admin/processor only)
    - processor_notes (admin/processor only)
    
  2. Salesperson Editable Fields (on assigned contacts)
    - name
    - email
    - phone
    - company
    - branch
    - address
    - birthday
    - drinks
    - client_type
    - grade
    - notes
    
  3. Security
    - Admins, super_admins, and processors can update any contact field
    - Regular users can fully update contacts they created
    - Salespersons assigned to a contact can update all fields except admin/processor fields
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
    OR
    -- Assigned salespersons can update all fields except admin/processor fields
    (
      EXISTS (
        SELECT 1 FROM assignments
        WHERE assignments.contact_id = contacts.id
        AND assignments.salesperson_id IN (
          SELECT id FROM sales_people WHERE user_id = auth.uid()
        )
      )
      AND
      -- Admin/processor fields must remain unchanged
      paralegal IS NOT DISTINCT FROM (SELECT paralegal FROM contacts AS old WHERE old.id = contacts.id)
      AND assigned_to IS NOT DISTINCT FROM (SELECT assigned_to FROM contacts AS old WHERE old.id = contacts.id)
      AND preferred_surveyor IS NOT DISTINCT FROM (SELECT preferred_surveyor FROM contacts AS old WHERE old.id = contacts.id)
      AND preferred_uw IS NOT DISTINCT FROM (SELECT preferred_uw FROM contacts AS old WHERE old.id = contacts.id)
      AND preferred_closer IS NOT DISTINCT FROM (SELECT preferred_closer FROM contacts AS old WHERE old.id = contacts.id)
      AND processor_notes IS NOT DISTINCT FROM (SELECT processor_notes FROM contacts AS old WHERE old.id = contacts.id)
    )
  );
