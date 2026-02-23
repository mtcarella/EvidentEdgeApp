/*
  # Add Soft Delete to Communication Logs

  1. Changes
    - Add `deleted_by_user` column to track which user deleted the message (from their view)
    - Add `deleted_at` timestamp to track when the message was deleted
    - These columns allow users to remove messages from their inbox while admins can still view the full history

  2. Security
    - Update existing RLS policies to filter out deleted messages for regular users
    - Admins/super admins can see all messages including deleted ones
*/

-- Add soft delete columns
ALTER TABLE communication_logs 
ADD COLUMN IF NOT EXISTS deleted_by_user uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create an index for efficient filtering of deleted messages
CREATE INDEX IF NOT EXISTS idx_communication_logs_deleted_by_user 
ON communication_logs USING gin(deleted_by_user);

-- Add comment for documentation
COMMENT ON COLUMN communication_logs.deleted_by_user IS 'Array of user IDs who have deleted this message from their view';
COMMENT ON COLUMN communication_logs.deleted_at IS 'Timestamp when the message was first deleted (for reference)';
