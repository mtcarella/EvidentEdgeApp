/*
  # Create Communication Reads Tracking System

  1. New Tables
    - `communication_reads`
      - `id` (uuid, primary key)
      - `communication_id` (uuid, FK to communication_logs)
      - `user_id` (uuid, the auth.users id of the reader)
      - `read_at` (timestamptz, when the communication was read)
      - Unique constraint on (communication_id, user_id) to prevent duplicates

  2. Security
    - Enable RLS on `communication_reads` table
    - Users can insert their own read receipts
    - Users can view their own read receipts
    - Admins can view all read receipts

  3. Purpose
    - Track which communications each user has read
    - Enable unread message count badges in the UI
*/

-- Create communication_reads table
CREATE TABLE IF NOT EXISTS communication_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES communication_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(communication_id, user_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_communication_reads_user ON communication_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_reads_communication ON communication_reads(communication_id);

-- Enable RLS
ALTER TABLE communication_reads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own read receipts
CREATE POLICY "Users can view their own read receipts"
  ON communication_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own read receipts
CREATE POLICY "Users can insert their own read receipts"
  ON communication_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Admins can view all read receipts
CREATE POLICY "Admins can view all read receipts"
  ON communication_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );