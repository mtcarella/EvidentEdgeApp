/*
  # Fix contacts delete policy to include super_admin role

  1. Changes
    - Update the delete policy on contacts table to allow super_admin and processor roles
    - Previously only admins could delete contacts

  2. Security
    - Maintains RLS protection
    - Only authenticated users with admin, super_admin, or processor role can delete contacts
*/

DROP POLICY IF EXISTS "Admins can delete contacts" ON contacts;

CREATE POLICY "Admins can delete contacts"
  ON contacts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin', 'processor')
    )
  );
