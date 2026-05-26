/*
  # Create system_settings table

  1. New Tables
    - `system_settings`
      - `id` (uuid, primary key)
      - `key` (text, unique) - identifies the setting
      - `value` (text) - stores the setting content
      - `updated_at` (timestamptz) - last modification timestamp

  2. Seed Data
    - Default row for `conflict_search_no_results_message`

  3. Security
    - Enable RLS on `system_settings`
    - All authenticated users can read settings
    - Only super_admins can insert/update settings
*/

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read system settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert system settings"
  ON system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update system settings"
  ON system_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
    )
  );

INSERT INTO system_settings (key, value)
VALUES (
  'conflict_search_no_results_message',
  'Great! You''ve Found a New Prospect!\n\nThis contact is **not** in our system yet. Please contact **Michele** to have them added to the system.\n\n*Great job on finding a new future client!*'
)
ON CONFLICT (key) DO NOTHING;
