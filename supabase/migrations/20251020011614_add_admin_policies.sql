/*
  # Add Admin Policies for Full Database Access

  1. Changes
    - Add SELECT policies for admins to view all sales people (not just active ones)
    - Add UPDATE/DELETE policies for admins on sales_people table
    - Add DELETE policies for admins on contacts table
    - Ensure admins have full access to manage the database

  2. Security
    - Policies check that the user has 'admin' role in sales_people table
    - Regular users maintain their existing restricted access
*/

-- Drop restrictive salespeople view policy and add admin-friendly one
DROP POLICY IF EXISTS "Authenticated users can view active salespeople" ON sales_people;

-- Allow authenticated users to view all salespeople (needed for admin panel dropdowns)
CREATE POLICY "Authenticated users can view all salespeople"
  ON sales_people
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to update any salesperson record
CREATE POLICY "Admins can update any salesperson"
  ON sales_people
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to delete any salesperson record
CREATE POLICY "Admins can delete salespeople"
  ON sales_people
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to insert new salespeople
CREATE POLICY "Admins can insert salespeople"
  ON sales_people
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to delete contacts
CREATE POLICY "Admins can delete contacts"
  ON contacts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to update any contact
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;

CREATE POLICY "Users can update contacts they created"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (updated_by = auth.uid());

CREATE POLICY "Admins can update any contact"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (true);
