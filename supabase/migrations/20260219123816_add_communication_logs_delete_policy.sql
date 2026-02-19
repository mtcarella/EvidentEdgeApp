/*
  # Add DELETE Policy for Communication Logs

  This migration adds the ability for admins and super admins to delete
  communication log entries from the history.

  ## Security Changes
  - Adds DELETE policy for communication_logs table
  - Only admin and super_admin roles can delete communication logs
  - Ensures proper authorization check before deletion

  ## Notes
  - This enables the "delete" feature in the Office Communications history tab
  - Deletion is permanent and cannot be undone
*/

-- Add DELETE policy for communication_logs
CREATE POLICY "Admins can delete communication logs"
ON communication_logs FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);
