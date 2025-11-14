/*
  # Fix Assignments Delete Policy Security Issue

  1. Security Changes
    - DROP the overly permissive "Authenticated users can delete assignments" policy
    - This policy currently uses USING (true) which allows ANY authenticated user to delete assignments
    - CREATE a new restrictive policy that only allows:
      - Admins (role = 'admin')
      - Super Admins (role = 'super_admin')
      - Processors (role = 'processor')
      - Users who created the assignment (assigned_by = auth.uid())
    
  2. Purpose
    - Prevent unauthorized deletion of contact assignments
    - Maintain data integrity by restricting deletion to appropriate users
    - Follow principle of least privilege
*/

-- Drop the insecure policy
DROP POLICY IF EXISTS "Authenticated users can delete assignments" ON assignments;

-- Create a secure, restrictive policy
CREATE POLICY "Authorized users can delete assignments"
  ON assignments
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role IN ('admin', 'super_admin', 'processor')
    ))
    OR
    (assigned_by = auth.uid())
  );
