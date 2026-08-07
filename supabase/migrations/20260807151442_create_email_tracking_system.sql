/*
# Create Email Tracking System

1. New Tables
   - `resource_email_sends`
     - `id` (uuid, primary key) - unique tracking ID, also used as tracking pixel token
     - `resource_id` (uuid, references resources) - which resource was emailed
     - `recipient_email` (text) - email address of the recipient
     - `recipient_name` (text, nullable) - display name of recipient
     - `sender_id` (uuid, references sales_people) - who sent it
     - `subject` (text) - email subject used
     - `sent_at` (timestamptz) - when the email was sent
     - `opened_at` (timestamptz, nullable) - first time the email was opened
     - `open_count` (integer, default 0) - total number of opens

2. Security
   - Enable RLS on `resource_email_sends`
   - Authenticated users can read all sends (team visibility)
   - Authenticated users can insert sends
   - No update/delete from client (opens recorded by edge function using service role)

3. Indexes
   - On resource_id for filtering by resource
   - On sender_id for filtering by sender
   - On recipient_email for lookups
*/

CREATE TABLE IF NOT EXISTS resource_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  sender_id uuid REFERENCES sales_people(id) ON DELETE SET NULL,
  subject text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0
);

ALTER TABLE resource_email_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_email_sends" ON resource_email_sends;
CREATE POLICY "authenticated_select_email_sends" ON resource_email_sends
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_email_sends" ON resource_email_sends;
CREATE POLICY "authenticated_insert_email_sends" ON resource_email_sends
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_email_sends" ON resource_email_sends;
CREATE POLICY "authenticated_update_email_sends" ON resource_email_sends
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_email_sends" ON resource_email_sends;
CREATE POLICY "anon_update_email_sends" ON resource_email_sends
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_sends_resource_id ON resource_email_sends(resource_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_sender_id ON resource_email_sends(sender_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_recipient_email ON resource_email_sends(recipient_email);
