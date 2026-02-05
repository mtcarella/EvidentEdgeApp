/*
  # Allow Processors to Edit Admin/Processor Fields in Contacts

  1. Changes
    - Update contacts table RLS policy to allow processor and sales_processor roles to edit contacts
    - Processors, sales_processors, admins, and super_admins can now update the following fields:
      - paralegal
      - preferred_surveyor
      - preferred_uw
      - preferred_closer
      - processor_notes
      - client_type
      - grade
      - client_paralegal_processor
      - evident_paralegal
      - marketing_points
      - and all other contact fields

  2. Security
    - Processors and sales_processors can update any contact
    - Salespersons can only update contacts assigned to them or shared with them
    - All changes maintain audit trail through updated_at and updated_by fields

  3. Notes
    - This allows processors to manage client assignments and preferences
    - Maintains existing access for admins, super_admins, and salespersons
*/

-- Drop existing contacts update policy
DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts;

-- Create new policy that includes processors and sales_processors
CREATE POLICY "Users can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.id = (select auth.uid())
      AND (
        -- Admins, super_admins, processors, and sales_processors can update any contact
        sp.role IN ('admin', 'super_admin', 'processor', 'sales_processor') OR
        -- Salespersons can only update contacts assigned to them
        (sp.role = 'salesperson' AND assigned_to = (select auth.uid()))
      )
    ) OR
    -- Shared access allows viewing user to update
    EXISTS (
      SELECT 1 FROM shared_contact_access sca
      WHERE sca.viewer_id = (select auth.uid())
      AND sca.salesperson_id = contacts.assigned_to
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.id = (select auth.uid())
      AND sp.role IN ('admin', 'super_admin', 'processor', 'sales_processor', 'salesperson')
    )
  );
