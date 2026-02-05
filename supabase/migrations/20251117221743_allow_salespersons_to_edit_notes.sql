/*
  # Allow salespersons to edit notes on assigned contacts

  1. Problem
    - Current policy only allows admins/processors/creators to update contacts
    - Salespersons assigned to contacts cannot edit the notes field
    
  2. Solution
    - Update WITH CHECK clause to allow salespersons to update notes field only
    - Keep USING clause the same (controls who can initiate updates)
    - WITH CHECK now allows updates if user is assigned to the contact
    
  3. Security
    - Admins, super_admins, and processors can update any contact field
    - Regular users can fully update contacts they created
    - Salespersons assigned to a contact can only update the notes field
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
    -- Assigned salespersons can update notes field only
    (
      EXISTS (
        SELECT 1 FROM assignments
        WHERE assignments.contact_id = contacts.id
        AND assignments.salesperson_id IN (
          SELECT id FROM sales_people WHERE user_id = auth.uid()
        )
      )
      AND
      -- Only notes field can be changed (all other fields must remain the same)
      name IS NOT DISTINCT FROM (SELECT name FROM contacts AS old WHERE old.id = contacts.id)
      AND type IS NOT DISTINCT FROM (SELECT type FROM contacts AS old WHERE old.id = contacts.id)
      AND email IS NOT DISTINCT FROM (SELECT email FROM contacts AS old WHERE old.id = contacts.id)
      AND phone IS NOT DISTINCT FROM (SELECT phone FROM contacts AS old WHERE old.id = contacts.id)
      AND company IS NOT DISTINCT FROM (SELECT company FROM contacts AS old WHERE old.id = contacts.id)
      AND branch IS NOT DISTINCT FROM (SELECT branch FROM contacts AS old WHERE old.id = contacts.id)
      AND address IS NOT DISTINCT FROM (SELECT address FROM contacts AS old WHERE old.id = contacts.id)
      AND paralegal IS NOT DISTINCT FROM (SELECT paralegal FROM contacts AS old WHERE old.id = contacts.id)
      AND preferred_surveyor IS NOT DISTINCT FROM (SELECT preferred_surveyor FROM contacts AS old WHERE old.id = contacts.id)
      AND preferred_uw IS NOT DISTINCT FROM (SELECT preferred_uw FROM contacts AS old WHERE old.id = contacts.id)
      AND preferred_closer IS NOT DISTINCT FROM (SELECT preferred_closer FROM contacts AS old WHERE old.id = contacts.id)
      AND birthday IS NOT DISTINCT FROM (SELECT birthday FROM contacts AS old WHERE old.id = contacts.id)
      AND drinks IS NOT DISTINCT FROM (SELECT drinks FROM contacts AS old WHERE old.id = contacts.id)
      AND client_type IS NOT DISTINCT FROM (SELECT client_type FROM contacts AS old WHERE old.id = contacts.id)
    )
  );
