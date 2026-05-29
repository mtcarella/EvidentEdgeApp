/*
  # Thread Management System

  1. Modified Tables
    - `communication_logs`
      - Added `last_activity_at` (timestamptz) - tracks the most recent activity in a thread
      - Added `is_archived` (boolean, default false) - whether the thread is archived

  2. New Tables
    - `user_thread_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users, unique)
      - `sort_mode` (text) - one of: recent_activity, newest_first, oldest_first, unread_first, manual
      - `manual_order` (jsonb) - array of thread IDs in user's custom order
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on `user_thread_preferences`
    - Users can only read/write their own preferences
    - All authenticated users can update `is_archived` and `last_activity_at` on communication_logs

  4. Data Backfill
    - Set `last_activity_at` to `sent_at` for existing top-level messages
    - Update `last_activity_at` based on most recent reply for threads with replies

  5. Trigger
    - Auto-update parent thread's `last_activity_at` when a reply is inserted
*/

-- Add columns to communication_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_logs' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE communication_logs ADD COLUMN last_activity_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_logs' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE communication_logs ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
END $$;

-- Backfill last_activity_at for existing top-level messages
UPDATE communication_logs
SET last_activity_at = sent_at
WHERE reply_to_message_id IS NULL AND last_activity_at IS NULL;

-- Backfill last_activity_at from most recent reply
UPDATE communication_logs parent
SET last_activity_at = sub.max_reply_at
FROM (
  SELECT reply_to_message_id, MAX(sent_at) as max_reply_at
  FROM communication_logs
  WHERE reply_to_message_id IS NOT NULL
  GROUP BY reply_to_message_id
) sub
WHERE parent.id = sub.reply_to_message_id
AND sub.max_reply_at > parent.last_activity_at;

-- Create trigger function to update last_activity_at on parent when reply is inserted
CREATE OR REPLACE FUNCTION update_thread_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reply_to_message_id IS NOT NULL THEN
    UPDATE communication_logs
    SET last_activity_at = NEW.sent_at
    WHERE id = NEW.reply_to_message_id
    AND (last_activity_at IS NULL OR last_activity_at < NEW.sent_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_activity ON communication_logs;
CREATE TRIGGER trigger_update_thread_activity
  AFTER INSERT ON communication_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_last_activity();

-- Create user_thread_preferences table
CREATE TABLE IF NOT EXISTS user_thread_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sort_mode text NOT NULL DEFAULT 'recent_activity',
  manual_order jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_thread_pref UNIQUE (user_id),
  CONSTRAINT valid_sort_mode CHECK (sort_mode IN ('recent_activity', 'newest_first', 'oldest_first', 'unread_first', 'manual'))
);

ALTER TABLE user_thread_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own thread preferences"
  ON user_thread_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own thread preferences"
  ON user_thread_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own thread preferences"
  ON user_thread_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own thread preferences"
  ON user_thread_preferences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster thread sorting queries
CREATE INDEX IF NOT EXISTS idx_communication_logs_last_activity
  ON communication_logs (last_activity_at DESC)
  WHERE reply_to_message_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_communication_logs_is_archived
  ON communication_logs (is_archived)
  WHERE reply_to_message_id IS NULL;
