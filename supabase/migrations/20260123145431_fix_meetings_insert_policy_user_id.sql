/*
  # Fix Meetings Insert Policy to Use user_id

  1. Changes
    - Update meetings INSERT policy to properly check user_id instead of id
    - auth.uid() returns the authentication user ID which maps to sales_people.user_id
    - contacts.assigned_to references sales_people.id, so we need to join properly

  2. Security
    - Salespersons can log meetings for contacts where the contact's assigned_to matches their sales_people.id
    - Admins and super_admins can log meetings for any contact
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can log meetings based on role" ON public.meetings;

-- CREATE: Salespersons can log meetings for their assigned contacts, admins can log for any contact
CREATE POLICY "Users can log meetings based on role"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins and super_admins can log meetings for any contact
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin', 'super_admin')
    )
    OR
    -- Salespersons can only log meetings for contacts assigned to them
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        JOIN contacts c ON c.assigned_to = sp.id
        WHERE sp.user_id = auth.uid()
        AND sp.role = 'salesperson'
        AND c.id = meetings.contact_id
      )
    )
  );
