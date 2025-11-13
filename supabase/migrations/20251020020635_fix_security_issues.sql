/*
  # Fix Security and Performance Issues

  ## Changes Made

  ### 1. Add Missing Indexes for Foreign Keys
    - Add index on `assignments.assigned_by`
    - Add index on `audit_logs.changed_by`
    - Add index on `contacts.updated_by`
    - Add index on `sales_people.user_id`

  ### 2. Optimize RLS Policies (Auth Function Initialization)
    - Update all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation of auth functions for each row, improving performance

  ### 3. Remove Unused Indexes
    - Drop `idx_contacts_type`
    - Drop `idx_contacts_created_by`
    - Drop `idx_audit_logs_table`
    - Drop `idx_audit_logs_record`
    - Drop `idx_sales_people_role`

  ### 4. Fix Function Search Paths
    - Set search_path for `update_updated_at_column` function
    - Set search_path for `audit_trigger_function` function

  ### 5. Consolidate Multiple Permissive Policies
    - Keep permissive policies but note for future consideration
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by ON assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_by ON contacts(updated_by);
CREATE INDEX IF NOT EXISTS idx_sales_people_user_id ON sales_people(user_id);

-- Drop unused indexes
DROP INDEX IF EXISTS idx_contacts_type;
DROP INDEX IF EXISTS idx_contacts_created_by;
DROP INDEX IF EXISTS idx_audit_logs_table;
DROP INDEX IF EXISTS idx_audit_logs_record;
DROP INDEX IF EXISTS idx_sales_people_role;

-- Fix RLS policies to optimize auth function calls
-- Drop and recreate policies with optimized auth function calls

-- Sales People Policies
DROP POLICY IF EXISTS "Users can view own record" ON sales_people;
CREATE POLICY "Users can view own record"
  ON sales_people
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own record" ON sales_people;
CREATE POLICY "Users can update own record"
  ON sales_people
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can update any salesperson" ON sales_people;
CREATE POLICY "Admins can update any salesperson"
  ON sales_people
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (select auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (select auth.uid())
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete salespeople" ON sales_people;
CREATE POLICY "Admins can delete salespeople"
  ON sales_people
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (select auth.uid())
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert salespeople" ON sales_people;
CREATE POLICY "Admins can insert salespeople"
  ON sales_people
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (select auth.uid())
      AND role = 'admin'
    )
  );

-- Contacts Policies
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
CREATE POLICY "Authenticated users can insert contacts"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can delete contacts" ON contacts;
CREATE POLICY "Admins can delete contacts"
  ON contacts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (select auth.uid())
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can update contacts they created" ON contacts;
CREATE POLICY "Users can update contacts they created"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can update any contact" ON contacts;
CREATE POLICY "Admins can update any contact"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (select auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (select auth.uid())
      AND role = 'admin'
    )
  );

-- Assignments Policies
DROP POLICY IF EXISTS "Authenticated users can insert assignments" ON assignments;
CREATE POLICY "Authenticated users can insert assignments"
  ON assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (assigned_by = (select auth.uid()));

-- Fix function search paths
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, record_id, action, changed_by, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', auth.uid(), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_values, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', auth.uid(), row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_values)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', auth.uid(), row_to_json(OLD));
    RETURN OLD;
  END IF;
END;
$$;
