/*
  # Restrict Contact Updates to Assigned Users

  ## Changes Made
  This migration updates the RLS policy for contacts to ensure users can only edit contacts that are assigned to them.

  ## Security Changes
  - Updated UPDATE policy on contacts table
  - Users can now only update contacts where they are the assigned salesperson
  - Maintains existing created_by and updated_by tracking
  - Prevents users from modifying contacts assigned to other salespeople

  ## Important Notes
  - Users must be the assigned salesperson (via assigned_to column) to update a contact
  - The policy checks that contacts.assigned_to matches the current user's sales_people.id
  - This ensures data integrity and prevents unauthorized modifications
*/

-- Drop the existing overly permissive update policy
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;

-- Create a new restrictive policy that only allows users to update their assigned contacts
CREATE POLICY "Users can update their assigned contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    assigned_to IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    updated_by = auth.uid() AND
    assigned_to IN (
      SELECT id FROM sales_people WHERE user_id = auth.uid()
    )
  );
