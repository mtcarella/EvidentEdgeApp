/*
  # Restrict Meetings to Assigned Salespersons

  1. Changes
    - Update meetings INSERT policy to only allow salespersons assigned to the contact
    - Update meetings SELECT policy to only show meetings to the salesperson who logged them or admins/super_admins
    - Update meetings UPDATE policy to only allow the salesperson who logged the meeting or admins/super_admins
    - Update meetings DELETE policy to only allow the salesperson who logged the meeting or admins/super_admins

  2. Security
    - Salespersons can only log meetings for contacts assigned to them
    - Salespersons can only view/edit/delete their own meetings
    - Admins and super_admins can view/edit/delete all meetings

  3. Notes
    - This ensures proper data isolation between salespersons
    - Maintains audit trail through created_by field
*/

-- Drop existing meetings policies
DROP POLICY IF EXISTS "Users can insert meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete meetings" ON public.meetings;

-- INSERT: Only allow salespersons to log meetings for contacts assigned to them
CREATE POLICY "Salespersons can log meetings for their contacts"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be a salesperson
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.id = (select auth.uid())
      AND sp.role = 'salesperson'
    )
    AND
    -- Contact must be assigned to this salesperson
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_id
      AND c.assigned_to = (select auth.uid())
    )
    AND
    -- salesperson_id must match the current user
    salesperson_id = (select auth.uid())
  );

-- SELECT: Only the salesperson who logged the meeting or admins/super_admins can view
CREATE POLICY "Users can view their own meetings or admins view all"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (
    salesperson_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- UPDATE: Only the salesperson who logged the meeting or admins/super_admins can update
CREATE POLICY "Users can update their own meetings or admins update all"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (
    salesperson_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    salesperson_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- DELETE: Only the salesperson who logged the meeting or admins/super_admins can delete
CREATE POLICY "Users can delete their own meetings or admins delete all"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (
    salesperson_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );
