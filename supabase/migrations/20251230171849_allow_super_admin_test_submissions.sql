/*
  # Allow Super Admins to Submit Test Rewards

  1. Changes
    - Add policy allowing super_admins to insert submissions for testing purposes
    - This enables super admins to test the rewards submission system

  2. Security
    - Only super_admin role can create test submissions
    - Super admins can submit on behalf of any closer for testing
*/

-- Allow super admins to insert submissions for testing
CREATE POLICY "Super admins can insert test submissions"
  ON closer_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );