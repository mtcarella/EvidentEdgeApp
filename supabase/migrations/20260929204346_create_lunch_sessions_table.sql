/*
# Create Lunch Sessions Table

1. New Tables
   - `lunch_sessions`
     - `id` (uuid, primary key)
     - `employee_id` (text, not null) - references sales_people.id
     - `employee_name` (text) - denormalized for easy querying
     - `clock_in` (timestamptz, not null) - when lunch started
     - `clock_out` (timestamptz) - when lunch ended, null if still on lunch
     - `duration_seconds` (integer) - computed duration in seconds
     - `created_at` (timestamptz)

2. Security
   - RLS enabled
   - Authenticated users can CRUD their own lunch sessions (matched via sales_people.user_id)

3. Indexes
   - On employee_id + created_at for daily lookups
*/

CREATE TABLE IF NOT EXISTS lunch_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  employee_name text,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lunch_sessions_employee_date
  ON lunch_sessions (employee_id, created_at DESC);

ALTER TABLE lunch_sessions ENABLE ROW LEVEL SECURITY;

-- Select: authenticated users can see their own sessions
DROP POLICY IF EXISTS "select_own_lunch_sessions" ON lunch_sessions;
CREATE POLICY "select_own_lunch_sessions" ON lunch_sessions FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id::text FROM sales_people WHERE user_id = auth.uid()
    )
  );

-- Insert: authenticated users can insert their own sessions
DROP POLICY IF EXISTS "insert_own_lunch_sessions" ON lunch_sessions;
CREATE POLICY "insert_own_lunch_sessions" ON lunch_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT id::text FROM sales_people WHERE user_id = auth.uid()
    )
  );

-- Update: authenticated users can update their own sessions
DROP POLICY IF EXISTS "update_own_lunch_sessions" ON lunch_sessions;
CREATE POLICY "update_own_lunch_sessions" ON lunch_sessions FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (
      SELECT id::text FROM sales_people WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id::text FROM sales_people WHERE user_id = auth.uid()
    )
  );

-- Delete: authenticated users can delete their own sessions
DROP POLICY IF EXISTS "delete_own_lunch_sessions" ON lunch_sessions;
CREATE POLICY "delete_own_lunch_sessions" ON lunch_sessions FOR DELETE
  TO authenticated
  USING (
    employee_id IN (
      SELECT id::text FROM sales_people WHERE user_id = auth.uid()
    )
  );

-- Admin/super_admin can see all lunch sessions
DROP POLICY IF EXISTS "admin_select_all_lunch_sessions" ON lunch_sessions;
CREATE POLICY "admin_select_all_lunch_sessions" ON lunch_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'processor', 'sales_processor')
    )
  );
