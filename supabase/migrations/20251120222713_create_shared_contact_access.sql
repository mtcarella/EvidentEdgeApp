/*
  # Create shared contact access system

  1. New Tables
    - `shared_contact_access`
      - `id` (uuid, primary key)
      - `viewer_id` (uuid, references sales_people) - The person who can view
      - `salesperson_id` (uuid, references sales_people) - The salesperson whose contacts they can view
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Initial Data
    - Grant Mike Carella access to Dean Ulan's contacts
    - Grant Mike Carella access to ETA III's contacts
    - Grant Mike Carella access to Lynn Delucia's contacts

  3. Security
    - Enable RLS on `shared_contact_access` table
    - Only admins and super_admins can modify this table
    - All authenticated users can read to check their access

  4. Notes
    - This allows flexible contact sharing without modifying core contact assignment logic
    - Users will see their own contacts plus any contacts they have shared access to
*/

-- Create shared_contact_access table
CREATE TABLE IF NOT EXISTS shared_contact_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  salesperson_id uuid NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(viewer_id, salesperson_id)
);

-- Enable RLS
ALTER TABLE shared_contact_access ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read (to check their access)
CREATE POLICY "Anyone can read shared access"
  ON shared_contact_access FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins and super_admins can insert
CREATE POLICY "Admins can insert shared access"
  ON shared_contact_access FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Policy: Only admins and super_admins can delete
CREATE POLICY "Admins can delete shared access"
  ON shared_contact_access FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Grant Mike Carella access to Dean Ulan's contacts
INSERT INTO shared_contact_access (viewer_id, salesperson_id)
VALUES 
  ('b396f0f8-219a-4a72-88b4-4e997e0db52a', '4480571a-1b00-4214-b976-14c8832afe53'),
  ('b396f0f8-219a-4a72-88b4-4e997e0db52a', '66edcbc0-da33-484d-b1b0-6f3f4057b994'),
  ('b396f0f8-219a-4a72-88b4-4e997e0db52a', '808f0ec1-98a6-46cc-8888-3e68cb6ab0d9')
ON CONFLICT (viewer_id, salesperson_id) DO NOTHING;