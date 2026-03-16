/*
  # Out of Office Status System

  This migration creates a system for users to set their out of office status
  which will be displayed to other users when they try to message them.

  1. New Tables
    - `user_out_of_office`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - The user who is out of office
      - `is_enabled` (boolean) - Whether the out of office status is currently active
      - `status_type` (text) - Type of absence: 'lunch', 'out_of_office', 'meeting', 'vacation', 'custom'
      - `custom_message` (text) - Custom message to display to other users
      - `start_time` (timestamptz) - When the out of office period starts (optional for immediate)
      - `end_time` (timestamptz) - When the out of office period ends (optional for indefinite)
      - `auto_disable` (boolean) - Whether to automatically disable when end_time is reached
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_out_of_office` table
    - Users can view all out of office statuses (to see alerts when messaging)
    - Users can only update their own out of office status
*/

CREATE TABLE IF NOT EXISTS user_out_of_office (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT false,
  status_type text NOT NULL DEFAULT 'out_of_office' CHECK (status_type IN ('lunch', 'out_of_office', 'meeting', 'vacation', 'custom')),
  custom_message text,
  start_time timestamptz,
  end_time timestamptz,
  auto_disable boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_out_of_office ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all out of office statuses"
  ON user_out_of_office
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own out of office status"
  ON user_out_of_office
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own out of office status"
  ON user_out_of_office
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own out of office status"
  ON user_out_of_office
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_out_of_office_user_id ON user_out_of_office(user_id);
CREATE INDEX IF NOT EXISTS idx_user_out_of_office_is_enabled ON user_out_of_office(is_enabled) WHERE is_enabled = true;