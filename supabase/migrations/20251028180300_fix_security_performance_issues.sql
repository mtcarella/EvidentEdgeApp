/*
  # Fix Security and Performance Issues

  1. Indexes
    - Add index for contacts.created_by foreign key
    - Drop unused indexes (idx_meetings_contact_id, idx_contacts_paralegal, idx_sales_people_user_id)

  2. RLS Policy Optimization
    - Fix auth.uid() calls to use (select auth.uid()) pattern for better performance
    - Consolidate multiple permissive policies into single policies with OR conditions
    
  3. Function Fixes
    - Set search_path for audit_trigger_function to prevent mutable search path issues

  4. Notes
    - Extension in public and leaked password protection are platform-level settings
    - These need to be handled through Supabase dashboard, not migrations
*/

-- ==========================================
-- 1. Add Missing Indexes
-- ==========================================

-- Add index for contacts.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by);

-- ==========================================
-- 2. Drop Unused Indexes
-- ==========================================

DROP INDEX IF EXISTS idx_meetings_contact_id;
DROP INDEX IF EXISTS idx_contacts_paralegal;
DROP INDEX IF EXISTS idx_sales_people_user_id;

-- ==========================================
-- 3. Fix Function Search Path
-- ==========================================

-- Drop and recreate audit_trigger_function with proper search_path
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (
      table_name,
      operation,
      old_data,
      performed_by
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      row_to_json(OLD),
      (SELECT auth.uid())
    );
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (
      table_name,
      operation,
      new_data,
      performed_by
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      row_to_json(NEW),
      (SELECT auth.uid())
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (
      table_name,
      operation,
      old_data,
      new_data,
      performed_by
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      row_to_json(OLD),
      row_to_json(NEW),
      (SELECT auth.uid())
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- ==========================================
-- 4. Fix and Consolidate RLS Policies
-- ==========================================

-- ===== SALES_PEOPLE TABLE =====

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert during signup" ON sales_people;
DROP POLICY IF EXISTS "Users can update own profile" ON sales_people;
DROP POLICY IF EXISTS "Admins can update any salesperson" ON sales_people;
DROP POLICY IF EXISTS "Admins can delete salespeople" ON sales_people;

-- Recreate with optimized auth calls and consolidation
CREATE POLICY "Users can insert during signup"
  ON sales_people FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update profile"
  ON sales_people FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
  );

CREATE POLICY "Admins can delete salespeople"
  ON sales_people FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- ===== CONTACTS TABLE =====

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Processors can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Processors can view all contacts" ON contacts;
DROP POLICY IF EXISTS "Admins can update any contact" ON contacts;
DROP POLICY IF EXISTS "Processors can update all contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts they created" ON contacts;
DROP POLICY IF EXISTS "Users can update their assigned contacts" ON contacts;

-- Recreate consolidated policies
CREATE POLICY "Users can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    -- Admins and processors can update any contact
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
    OR
    -- Users can update contacts they created
    created_by = (SELECT auth.uid())
    OR
    -- Users can update their assigned contacts
    EXISTS (
      SELECT 1 FROM assignments
      WHERE contact_id = contacts.id
      AND salesperson_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
    OR
    created_by = (SELECT auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM assignments
      WHERE contact_id = contacts.id
      AND salesperson_id = (SELECT auth.uid())
    )
  );

-- ===== ASSIGNMENTS TABLE =====

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view assignments" ON assignments;
DROP POLICY IF EXISTS "Processors can view all assignments" ON assignments;
DROP POLICY IF EXISTS "Admins can update any assignment" ON assignments;
DROP POLICY IF EXISTS "Users can update assignments they created" ON assignments;

-- Recreate consolidated policies
CREATE POLICY "Users can view assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update assignments"
  ON assignments FOR UPDATE
  TO authenticated
  USING (
    -- Admins can update any assignment
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
    OR
    -- Users can update assignments they created
    assigned_by = (SELECT auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
    OR
    assigned_by = (SELECT auth.uid())
  );

-- ===== MEETINGS TABLE =====

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert any meeting" ON meetings;
DROP POLICY IF EXISTS "Processors can insert meetings for any contact" ON meetings;
DROP POLICY IF EXISTS "Users can insert meetings for their contacts" ON meetings;
DROP POLICY IF EXISTS "Admins can view all meetings" ON meetings;
DROP POLICY IF EXISTS "Processors can view all meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view meetings for their contacts" ON meetings;
DROP POLICY IF EXISTS "Admins can update any meeting" ON meetings;
DROP POLICY IF EXISTS "Processors can update their meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update meetings they created" ON meetings;
DROP POLICY IF EXISTS "Admins can delete any meeting" ON meetings;
DROP POLICY IF EXISTS "Processors can delete their meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete meetings they created" ON meetings;

-- Recreate consolidated policies
CREATE POLICY "Users can insert meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins and processors can insert any meeting
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
    OR
    -- Users can insert meetings for their assigned contacts
    EXISTS (
      SELECT 1 FROM assignments
      WHERE contact_id = meetings.contact_id
      AND salesperson_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can view meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    -- Admins and processors can view all meetings
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
    OR
    -- Users can view meetings for their assigned contacts
    EXISTS (
      SELECT 1 FROM assignments
      WHERE contact_id = meetings.contact_id
      AND salesperson_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (
    -- Admins can update any meeting
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
    OR
    -- Processors and users can update meetings they created
    (
      created_by = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE id = (SELECT auth.uid())
        AND role IN ('processor', 'salesperson')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
    OR
    (
      created_by = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE id = (SELECT auth.uid())
        AND role IN ('processor', 'salesperson')
      )
    )
  );

CREATE POLICY "Users can delete meetings"
  ON meetings FOR DELETE
  TO authenticated
  USING (
    -- Admins can delete any meeting
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
    OR
    -- Processors and users can delete meetings they created
    (
      created_by = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM sales_people
        WHERE id = (SELECT auth.uid())
        AND role IN ('processor', 'salesperson')
      )
    )
  );
