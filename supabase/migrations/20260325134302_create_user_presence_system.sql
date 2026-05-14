/*
  # User Presence System

  1. New Tables
    - `user_presence`
      - `user_id` (uuid, primary key, references auth.users)
      - `status` (text) - 'online', 'offline', 'do_not_disturb'
      - `last_seen` (timestamptz) - last activity timestamp
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_presence` table
    - All authenticated users can view presence of other users
    - Users can only update their own presence

  3. Notes
    - Presence is tracked via heartbeat updates from the client
    - Users are considered offline after 2 minutes of inactivity
*/

CREATE TABLE IF NOT EXISTS user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'do_not_disturb')),
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all presence"
  ON user_presence
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own presence"
  ON user_presence
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON user_presence
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_presence(p_status text DEFAULT 'online')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_presence (user_id, status, last_seen, updated_at)
  VALUES (auth.uid(), p_status, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    last_seen = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION set_user_offline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_presence
  SET status = 'offline', updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen);