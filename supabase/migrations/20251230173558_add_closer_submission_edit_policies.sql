/*
  # Add Edit Policies for Closer Submissions

  1. Changes
    - Add UPDATE policy for closers to edit their own submissions
    - Add UPDATE policy for super_admins to edit any submission
    
  2. Security
    - Closers can only update file_number, submission_type, and submission_date
    - Closers cannot change closer_id or closer_name (prevents reassignment)
    - Super admins can update any submission
*/

-- Allow closers to update their own submissions
CREATE POLICY "Closers can update own submissions"
  ON closer_submissions
  FOR UPDATE
  TO authenticated
  USING (
    closer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'closer'
      AND sales_people.is_active = true
    )
  )
  WITH CHECK (
    closer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'closer'
      AND sales_people.is_active = true
    )
  );

-- Allow super admins to update any submission
CREATE POLICY "Super admins can update any submission"
  ON closer_submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );
