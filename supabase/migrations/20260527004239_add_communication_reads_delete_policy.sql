/*
  # Add delete policy for communication_reads

  1. Security Changes
    - Add DELETE policy on `communication_reads` so users can remove their own read receipts
      (needed for "mark as unread" functionality)
*/

CREATE POLICY "Users can delete their own read receipts"
  ON communication_reads
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
