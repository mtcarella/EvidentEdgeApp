/*
  # Add User Roles System

  1. Changes
    - Add `role` column to `sales_people` table with values 'admin' or 'user'
    - Default role is 'user'
    - Add index for faster role-based queries

  2. Notes
    - Existing users will default to 'user' role
    - Admin users will have full access
    - Regular users will have limited access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_people' AND column_name = 'role'
  ) THEN
    ALTER TABLE sales_people ADD COLUMN role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_people_role ON sales_people(role);
