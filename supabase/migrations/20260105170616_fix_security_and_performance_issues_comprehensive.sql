/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes on Foreign Keys
    - Add index on contacts.created_by (references auth.users)
    - Add index on resources.uploaded_by (references sales_people)
    - Add index on shared_contact_access.created_by (references auth.users)
    - Add index on shared_contact_access.salesperson_id (references sales_people)
    - Add index on user_module_permissions.granted_by (references auth.users)

  2. Remove Unused Indexes
    - Drop unused indexes to reduce database overhead

  3. Fix RLS Policies for Performance
    - Wrap all auth.uid() calls with (select auth.uid()) to prevent re-evaluation
    - Update policies across all affected tables

  4. Fix Function Search Paths
    - Set secure search path for all functions

  5. Consolidate Multiple Permissive Policies
    - Merge duplicate policies where appropriate

  ## Notes
    - These changes improve query performance significantly
    - RLS policies will execute faster with single auth.uid() evaluation
    - Indexes on foreign keys improve join performance
*/

-- ============================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON public.contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_resources_uploaded_by ON public.resources(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_shared_contact_access_created_by ON public.shared_contact_access(created_by);
CREATE INDEX IF NOT EXISTS idx_shared_contact_access_salesperson_id ON public.shared_contact_access(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_granted_by ON public.user_module_permissions(granted_by);

-- ============================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS idx_weekly_reports_processor_id;
DROP INDEX IF EXISTS idx_verified_wires_created_by;
DROP INDEX IF EXISTS idx_wire_verification_logs_created_by;
DROP INDEX IF EXISTS idx_wire_verification_logs_verified_wire_id;
DROP INDEX IF EXISTS idx_closer_submissions_file_number;
DROP INDEX IF EXISTS idx_closer_submissions_type;
DROP INDEX IF EXISTS idx_resources_created_at;
DROP INDEX IF EXISTS idx_login_attempts_created_at;
DROP INDEX IF EXISTS idx_user_module_permissions_module_name;
DROP INDEX IF EXISTS idx_weekly_reports_type;

-- ============================================================
-- 3. FIX RLS POLICIES - ASSIGNMENTS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Users can insert assignments they create" ON public.assignments;
DROP POLICY IF EXISTS "Sales people can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins can update any assignment" ON public.assignments;
DROP POLICY IF EXISTS "Users can update assignments they created" ON public.assignments;
DROP POLICY IF EXISTS "Users can update assignments" ON public.assignments;
DROP POLICY IF EXISTS "Authorized users can delete assignments" ON public.assignments;

CREATE POLICY "Users can insert assignments"
  ON public.assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    assigned_by = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin', 'salesperson', 'closer', 'processor', 'sales_processor')
    )
  );

CREATE POLICY "Users can update assignments"
  ON public.assignments FOR UPDATE
  TO authenticated
  USING (
    assigned_by = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    assigned_by = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can delete assignments"
  ON public.assignments FOR DELETE
  TO authenticated
  USING (
    assigned_by = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 4. FIX RLS POLICIES - CONTACTS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;

CREATE POLICY "Users can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.id = (select auth.uid())
      AND (
        sp.role IN ('admin', 'super_admin') OR
        sp.role = 'salesperson' AND assigned_to = (select auth.uid())
      )
    ) OR
    EXISTS (
      SELECT 1 FROM shared_contact_access sca
      WHERE sca.viewer_id = (select auth.uid())
      AND sca.salesperson_id = contacts.assigned_to
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.id = (select auth.uid())
      AND (
        sp.role IN ('admin', 'super_admin') OR
        sp.role = 'salesperson'
      )
    )
  );

CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 5. FIX RLS POLICIES - CLOSER_SUBMISSIONS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Closers can update own submissions" ON public.closer_submissions;
DROP POLICY IF EXISTS "Super admins can update any submission" ON public.closer_submissions;
DROP POLICY IF EXISTS "Super admins can update submissions" ON public.closer_submissions;
DROP POLICY IF EXISTS "Closers can delete own submissions" ON public.closer_submissions;
DROP POLICY IF EXISTS "Super admins can delete submissions" ON public.closer_submissions;
DROP POLICY IF EXISTS "Closers can insert own submissions" ON public.closer_submissions;
DROP POLICY IF EXISTS "Super admins can insert test submissions" ON public.closer_submissions;
DROP POLICY IF EXISTS "Users can view submissions based on role" ON public.closer_submissions;

CREATE POLICY "Users can view submissions"
  ON public.closer_submissions FOR SELECT
  TO authenticated
  USING (
    closer_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can insert submissions"
  ON public.closer_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    (closer_id = (select auth.uid()) AND EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role = 'closer'
    )) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('super_admin')
    )
  );

CREATE POLICY "Users can update submissions"
  ON public.closer_submissions FOR UPDATE
  TO authenticated
  USING (
    closer_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    closer_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can delete submissions"
  ON public.closer_submissions FOR DELETE
  TO authenticated
  USING (
    closer_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('super_admin')
    )
  );

-- ============================================================
-- 6. FIX RLS POLICIES - MEETINGS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Users can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can insert meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete meetings" ON public.meetings;

CREATE POLICY "Users can view meetings"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (
    salesperson_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can insert meetings"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    salesperson_id = (select auth.uid())
  );

CREATE POLICY "Users can update meetings"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (
    salesperson_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    salesperson_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can delete meetings"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (
    salesperson_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 7. FIX RLS POLICIES - RESOURCES TABLE
-- ============================================================

DROP POLICY IF EXISTS "Admins can insert resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can delete resources" ON public.resources;

CREATE POLICY "Admins can insert resources"
  ON public.resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete resources"
  ON public.resources FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 8. FIX RLS POLICIES - SALES_PEOPLE TABLE
-- ============================================================

DROP POLICY IF EXISTS "Admins can insert salespeople" ON public.sales_people;
DROP POLICY IF EXISTS "Users can update profile" ON public.sales_people;

CREATE POLICY "Admins can insert salespeople"
  ON public.sales_people FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can update profile"
  ON public.sales_people FOR UPDATE
  TO authenticated
  USING (
    id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('super_admin')
    )
  )
  WITH CHECK (
    id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('super_admin')
    )
  );

-- ============================================================
-- 9. FIX RLS POLICIES - SHARED_CONTACT_ACCESS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Admins can insert shared access" ON public.shared_contact_access;
DROP POLICY IF EXISTS "Admins can delete shared access" ON public.shared_contact_access;

CREATE POLICY "Admins can insert shared access"
  ON public.shared_contact_access FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete shared access"
  ON public.shared_contact_access FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 10. FIX RLS POLICIES - LOGIN_ATTEMPTS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;

CREATE POLICY "Admins can view login attempts"
  ON public.login_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 11. FIX RLS POLICIES - WIRE_VERIFICATION_LOGS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Admins and super_admins can view all verification logs" ON public.wire_verification_logs;

CREATE POLICY "Admins can view verification logs"
  ON public.wire_verification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 12. FIX RLS POLICIES - WEEKLY_PERFORMANCE_REPORTS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Authorized users can insert reports" ON public.weekly_performance_reports;
DROP POLICY IF EXISTS "Processors and admins can insert reports" ON public.weekly_performance_reports;
DROP POLICY IF EXISTS "Users can view reports based on role" ON public.weekly_performance_reports;
DROP POLICY IF EXISTS "Admins and super admins can delete reports" ON public.weekly_performance_reports;
DROP POLICY IF EXISTS "Processors and admins can update reports" ON public.weekly_performance_reports;

CREATE POLICY "Users can insert reports"
  ON public.weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    processor_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('processor', 'admin', 'super_admin', 'sales_processor')
    )
  );

CREATE POLICY "Users can view reports"
  ON public.weekly_performance_reports FOR SELECT
  TO authenticated
  USING (
    processor_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin', 'sales_processor', 'closer')
    )
  );

CREATE POLICY "Users can update reports"
  ON public.weekly_performance_reports FOR UPDATE
  TO authenticated
  USING (
    processor_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    processor_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete reports"
  ON public.weekly_performance_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 13. FIX RLS POLICIES - USER_MODULE_PERMISSIONS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Users can view own module permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Admins can insert module permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Admins can update module permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Admins can delete module permissions" ON public.user_module_permissions;

CREATE POLICY "Users can view module permissions"
  ON public.user_module_permissions FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert module permissions"
  ON public.user_module_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update module permissions"
  ON public.user_module_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete module permissions"
  ON public.user_module_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 14. FIX FUNCTION SEARCH PATHS
-- ============================================================

ALTER FUNCTION public.cleanup_old_login_attempts() SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_user_module_permissions_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.encrypt_wire_data(text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.decrypt_wire_data(bytea) SET search_path = pg_catalog, public;
ALTER FUNCTION public.encrypt_verified_wires_on_insert() SET search_path = pg_catalog, public;
ALTER FUNCTION public.encrypt_wire_logs_on_insert() SET search_path = pg_catalog, public;