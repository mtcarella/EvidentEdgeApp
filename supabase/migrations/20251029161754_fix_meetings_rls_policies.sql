/*
  # Fix Meetings RLS Policies

  ## Changes Made
  
  1. **Fix RLS Policy Bug**
     - All policies were incorrectly checking `sales_people.id = auth.uid()`
     - Should be checking `sales_people.user_id = auth.uid()` instead
     - This prevented users from inserting/updating/deleting meetings
  
  2. **Updated Policies**
     - Users can view meetings (SELECT) - admins, processors, or assigned salespeople
     - Users can insert meetings (INSERT) - admins, processors, or assigned salespeople
     - Users can update meetings (UPDATE) - admins, or the creator of the meeting
     - Users can delete meetings (DELETE) - admins, or the creator of the meeting
  
  ## Security Notes
  - Only authenticated users can access meetings
  - Meetings are restricted to assigned salespeople and admins/processors
  - Users can only modify meetings they created (except admins)
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete meetings" ON meetings;

-- Policy for SELECT: Admins, processors, or assigned salespeople can view meetings
CREATE POLICY "Users can view meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    -- Admins and processors can view all meetings
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'processor', 'super_admin')
    )
    OR
    -- Salespeople can view meetings for their assigned contacts
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.contact_id = meetings.contact_id
      AND assignments.salesperson_id IN (
        SELECT id FROM sales_people WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for INSERT: Admins, processors, or assigned salespeople can insert meetings
CREATE POLICY "Users can insert meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins and processors can insert meetings for any contact
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'processor', 'super_admin')
    )
    OR
    -- Salespeople can insert meetings for their assigned contacts
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.contact_id = meetings.contact_id
      AND assignments.salesperson_id IN (
        SELECT id FROM sales_people WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for UPDATE: Admins or the creator can update meetings
CREATE POLICY "Users can update meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (
    -- Admins can update any meeting
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
    OR
    -- Users can update their own meetings
    (
      created_by IN (SELECT id FROM sales_people WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('processor', 'user')
      )
    )
  )
  WITH CHECK (
    -- Admins can update any meeting
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
    OR
    -- Users can update their own meetings
    (
      created_by IN (SELECT id FROM sales_people WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('processor', 'user')
      )
    )
  );

-- Policy for DELETE: Admins or the creator can delete meetings
CREATE POLICY "Users can delete meetings"
  ON meetings FOR DELETE
  TO authenticated
  USING (
    -- Admins can delete any meeting
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
    OR
    -- Users can delete their own meetings
    (
      created_by IN (SELECT id FROM sales_people WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('processor', 'user')
      )
    )
  );
