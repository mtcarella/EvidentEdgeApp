/*
  # Add Paralegal Field and Processor Role

  ## Summary
  This migration adds a paralegal field to the contacts table and creates a new "processor" user role
  with permissions to view and edit all contacts regardless of assignment.

  ## 1. Changes to Tables
    - `contacts` table:
      - Add `paralegal` column (text, optional) - Stores the assigned paralegal name
      - Valid values: 'Kristen', 'Lisa', 'Raphael', 'Danielle', or NULL

    - `sales_people` table:
      - Update role constraint to include 'processor' role
      - Valid roles: 'user', 'admin', 'processor'

  ## 2. Security Changes (RLS Policies)
    - Add policies for processor role to view all contacts
    - Add policies for processor role to update all contacts
    - Processors have same base permissions as users but can see/edit all contacts
    - Processors can view all meetings for all contacts
    - Processors can insert meetings for any contact
    - Processors can update/delete meetings they created

  ## 3. Important Notes
    - Paralegal field is optional (can be NULL)
    - Processor role has broader access than regular users
    - Processor role cannot delete contacts (admin only)
    - All existing contacts will have NULL paralegal initially
*/

-- Add paralegal column to contacts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'paralegal'
  ) THEN
    ALTER TABLE contacts ADD COLUMN paralegal text CHECK (paralegal IN ('Kristen', 'Lisa', 'Raphael', 'Danielle'));
  END IF;
END $$;

-- Update role constraint on sales_people to include processor
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sales_people_role_check' AND table_name = 'sales_people'
  ) THEN
    ALTER TABLE sales_people DROP CONSTRAINT sales_people_role_check;
  END IF;

  -- Add new constraint with processor role
  ALTER TABLE sales_people ADD CONSTRAINT sales_people_role_check CHECK (role IN ('user', 'admin', 'processor'));
END $$;

-- Add index on paralegal for faster filtering
CREATE INDEX IF NOT EXISTS idx_contacts_paralegal ON contacts(paralegal);

-- RLS Policies for processor role to view all contacts
CREATE POLICY "Processors can view all contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  );

-- RLS Policies for processor role to update all contacts
CREATE POLICY "Processors can update all contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  );

-- RLS Policies for processor role to insert contacts
CREATE POLICY "Processors can insert contacts"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  );

-- RLS Policies for processor role to view all assignments
CREATE POLICY "Processors can view all assignments"
  ON assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  );

-- RLS Policies for processor role to view all meetings
CREATE POLICY "Processors can view all meetings"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  );

-- RLS Policies for processor role to insert meetings for any contact
CREATE POLICY "Processors can insert meetings for any contact"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  );

-- RLS Policies for processor role to update meetings they created
CREATE POLICY "Processors can update their meetings"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  );

-- RLS Policies for processor role to delete meetings they created
CREATE POLICY "Processors can delete their meetings"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'processor'
    )
  );
