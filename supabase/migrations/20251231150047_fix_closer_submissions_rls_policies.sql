/*
  # Fix Closer Submissions RLS Policies

  1. Changes
    - Drop and recreate all RLS policies for closer_submissions table
    - Fix the auth check to use sales_people.user_id instead of sales_people.id
    - This ensures admins like John Bucci can view all submissions

  2. Security
    - Closers can insert and view their own submissions
    - Admins and super_admins can view all submissions
    - Super_admins can insert test submissions
    - Super_admins can delete submissions
    - Super_admins can update submissions
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Closers can insert own submissions" ON closer_submissions;
DROP POLICY IF EXISTS "Closers can view own submissions" ON closer_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON closer_submissions;
DROP POLICY IF EXISTS "Super admins can delete submissions" ON closer_submissions;
DROP POLICY IF EXISTS "Super admins can insert test submissions" ON closer_submissions;

-- Recreate policies with correct user_id checks

-- Closers can insert their own submissions
CREATE POLICY "Closers can insert own submissions"
  ON closer_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = closer_submissions.closer_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role = 'closer'
      AND sales_people.is_active = true
    )
  );

-- Super admins can insert test submissions
CREATE POLICY "Super admins can insert test submissions"
  ON closer_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );

-- Closers can view their own submissions, admins and super_admins can view all
CREATE POLICY "Users can view submissions based on role"
  ON closer_submissions FOR SELECT
  TO authenticated
  USING (
    -- Closers can view their own submissions
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = closer_submissions.closer_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role = 'closer'
    ) OR
    -- Admins and super_admins can view all submissions
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Super admins can delete submissions
CREATE POLICY "Super admins can delete submissions"
  ON closer_submissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );

-- Super admins can update submissions
CREATE POLICY "Super admins can update submissions"
  ON closer_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );
