/*
  # Allow Admins to Log Meetings

  1. Changes
    - Update meetings INSERT policy to allow admins and super_admins to log meetings for any contact
    - Salespersons can only log meetings for contacts assigned to them
    - Admins/super_admins can log meetings for any contact

  2. Security
    - Maintains proper access control
    - Admins have broader access to log meetings
    - Salespersons remain restricted to their assigned contacts
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Salespersons can log meetings for their contacts" ON public.meetings;

-- INSERT: Salespersons can log meetings for their assigned contacts, admins can log for any contact
CREATE POLICY "Users can log meetings based on role"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins and super_admins can log meetings for any contact
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.id = (select auth.uid())
      AND sp.role IN ('admin', 'super_admin')
    )
    OR
    -- Salespersons can only log meetings for contacts assigned to them
    (
      EXISTS (
        SELECT 1 FROM sales_people sp
        WHERE sp.id = (select auth.uid())
        AND sp.role = 'salesperson'
      )
      AND
      EXISTS (
        SELECT 1 FROM contacts c
        WHERE c.id = contact_id
        AND c.assigned_to = (select auth.uid())
      )
    )
  );
