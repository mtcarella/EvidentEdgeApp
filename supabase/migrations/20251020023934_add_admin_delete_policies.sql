/*
  # Add Admin Delete and Update Policies

  1. Changes
    - Add DELETE policy for admins to delete sales_people records
    - Add UPDATE policy for admins to update any sales_people records
    - These policies check that the user has 'admin' role in the sales_people table
  
  2. Security
    - Only users with role='admin' can delete or update other users
    - Regular users can still update their own profile
    - All policies check authentication
*/

-- Add admin update policy for sales_people
CREATE POLICY "Admins can update any salesperson"
  ON sales_people FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'admin'
    )
  );

-- Add admin delete policy for sales_people
CREATE POLICY "Admins can delete salespeople"
  ON sales_people FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'admin'
    )
  );