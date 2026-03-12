/*
  # Add Delete Policy for Direct Messages

  1. Security
    - Users can delete their own messages from conversations they participate in
    - Only the sender of a message can delete it

  2. Changes
    - Adds DELETE policy on direct_messages table for authenticated users
*/

CREATE POLICY "Users can delete their own messages"
  ON direct_messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());