/*
  # Add UPDATE Policy for Assignments Table

  1. Changes
    - Add UPDATE policy for the assignments table to allow authenticated users to update assignments
    - This allows admins and users to reassign contacts to different salespeople

  2. Security
    - Only authenticated users can update assignments
    - Regular users can update assignments they created (assigned_by = auth.uid())
    - Admins can update any assignment
*/

-- Add UPDATE policy for regular users (can update assignments they created)
CREATE POLICY "Users can update assignments they created"
  ON assignments
  FOR UPDATE
  TO authenticated
  USING (assigned_by = (SELECT auth.uid()))
  WITH CHECK (assigned_by = (SELECT auth.uid()));

-- Add UPDATE policy for admins (can update any assignment)
CREATE POLICY "Admins can update any assignment"
  ON assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );
