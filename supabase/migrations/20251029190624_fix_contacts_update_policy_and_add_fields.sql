/*
  # Fix contacts update policy and add new fields

  1. New Fields
    - `client_type` (text) - Options: 'client' or 'prospect'
    - `grade` (text) - Options: 'A', 'B', or 'C'
    - `company` (text) - Already exists, no changes needed

  2. Changes
    - Update contacts update policy to include super_admin role
    - Add client_type field with default value
    - Add grade field with default value
    - Add check constraints to ensure valid values

  3. Security
    - Admins, super_admins, and processors can update any contact
    - Users can only update contacts they created or are assigned to
*/

-- Add new fields to contacts table
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS client_type text DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS grade text DEFAULT 'C';

-- Add check constraints for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_client_type_check'
  ) THEN
    ALTER TABLE contacts 
      ADD CONSTRAINT contacts_client_type_check 
      CHECK (client_type IN ('client', 'prospect'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_grade_check'
  ) THEN
    ALTER TABLE contacts 
      ADD CONSTRAINT contacts_grade_check 
      CHECK (grade IN ('A', 'B', 'C'));
  END IF;
END $$;

-- Drop and recreate the update policy with super_admin included
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
    -- Users can update contacts assigned to them
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.contact_id = contacts.id
      AND assignments.salesperson_id IN (
        SELECT id FROM sales_people WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin', 'processor')
    )
    OR
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
