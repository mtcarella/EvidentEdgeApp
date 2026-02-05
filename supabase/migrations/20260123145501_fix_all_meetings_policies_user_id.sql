/*
  # Fix All Meetings Policies to Use user_id Correctly

  1. Changes
    - Update all meetings policies to properly check user_id instead of id
    - The salesperson_id column in meetings stores sales_people.id
    - auth.uid() returns the authentication user ID which maps to sales_people.user_id
    - Need to join sales_people to match auth.uid() with user_id, then check salesperson_id matches id

  2. Security
    - SELECT: Users can view meetings they logged, admins can view all
    - UPDATE: Users can update meetings they logged, admins can update all
    - DELETE: Users can delete meetings they logged, admins can delete all
    - INSERT: Salespersons can log meetings for their assigned contacts, admins can log for any
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own meetings or admins view all" ON public.meetings;
DROP POLICY IF EXISTS "Users can update their own meetings or admins update all" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings or admins delete all" ON public.meetings;

-- SELECT: Users can view their own meetings or admins view all
CREATE POLICY "Users can view their own meetings or admins view all"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (
    -- User's own meetings (match via sales_people)
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.id = salesperson_id
    )
    OR
    -- Admins and super_admins can view all meetings
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin', 'super_admin')
    )
  );

-- UPDATE: Users can update their own meetings or admins update all
CREATE POLICY "Users can update their own meetings or admins update all"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (
    -- User's own meetings (match via sales_people)
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.id = salesperson_id
    )
    OR
    -- Admins and super_admins can update all meetings
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    -- User's own meetings (match via sales_people)
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.id = salesperson_id
    )
    OR
    -- Admins and super_admins can update all meetings
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin', 'super_admin')
    )
  );

-- DELETE: Users can delete their own meetings or admins delete all
CREATE POLICY "Users can delete their own meetings or admins delete all"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (
    -- User's own meetings (match via sales_people)
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.id = salesperson_id
    )
    OR
    -- Admins and super_admins can delete all meetings
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin', 'super_admin')
    )
  );
