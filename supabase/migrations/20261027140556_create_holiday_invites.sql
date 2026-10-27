/*
# Holiday Card / Party Invite list

1. New Tables
- `holiday_invites`: one row per (user, contact) the user plans to send a holiday card / party invite to.
  - `id` (uuid, primary key)
  - `contact_id` (uuid, references contacts, cascade delete)
  - `user_id` (uuid, defaults to the signed-in user)
  - `created_at` (timestamptz)
  - Unique on (user_id, contact_id)

2. Security
- RLS enabled; each signed-in user can only see, add, change or remove their own invite marks.
- Grants SELECT, INSERT, DELETE to authenticated (UPDATE not needed).

3. Notes
1. Stored per user (not on the contact itself) so shared and global contacts can be marked independently by each salesperson.
*/

CREATE TABLE IF NOT EXISTS holiday_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS holiday_invites_contact_id_idx ON holiday_invites(contact_id);

ALTER TABLE holiday_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON holiday_invites TO authenticated;

DROP POLICY IF EXISTS "select_own_holiday_invites" ON holiday_invites;
CREATE POLICY "select_own_holiday_invites" ON holiday_invites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_holiday_invites" ON holiday_invites;
CREATE POLICY "insert_own_holiday_invites" ON holiday_invites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_holiday_invites" ON holiday_invites;
CREATE POLICY "delete_own_holiday_invites" ON holiday_invites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
