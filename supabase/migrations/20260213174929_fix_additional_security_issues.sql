/*
  # Fix Additional Security and Performance Issues

  This migration addresses remaining security and performance issues:

  ## 1. Add Missing Foreign Key Indexes (7 new indexes)
    - communication_logs.sent_by
    - contacts.created_by
    - resources.uploaded_by
    - shared_contact_access.created_by
    - shared_contact_access.salesperson_id
    - user_group_members.user_id
    - user_module_permissions.granted_by

  ## 2. Remove Unused Indexes (7 indexes)
    - Drop recently created indexes that are not being used

  ## 3. Fix Multiple Permissive Policies
    - Consolidate overlapping policies on performance_report_reminders

  ## 4. Fix Function Search Path
    - Set search_path for the parameterless check_missing_reports function

  ## 5. Login Attempts Policy
    - Keep intentionally permissive for security monitoring purposes
*/

-- =============================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_by ON public.communication_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON public.contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_resources_uploaded_by ON public.resources(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_shared_contact_access_created_by ON public.shared_contact_access(created_by);
CREATE INDEX IF NOT EXISTS idx_shared_contact_access_salesperson_id ON public.shared_contact_access(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user_id ON public.user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_granted_by ON public.user_module_permissions(granted_by);

-- =============================================
-- 2. DROP UNUSED INDEXES
-- =============================================

DROP INDEX IF EXISTS idx_announcements_created_by;
DROP INDEX IF EXISTS idx_communication_logs_group_id;
DROP INDEX IF EXISTS idx_user_groups_created_by;
DROP INDEX IF EXISTS idx_verified_wires_created_by;
DROP INDEX IF EXISTS idx_weekly_performance_reports_processor_id;
DROP INDEX IF EXISTS idx_wire_verification_logs_created_by;
DROP INDEX IF EXISTS idx_wire_verification_logs_verified_wire_id;

-- =============================================
-- 3. FIX MULTIPLE PERMISSIVE POLICIES - PERFORMANCE_REPORT_REMINDERS
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view reminders" ON public.performance_report_reminders;
DROP POLICY IF EXISTS "Super admin can manage reminders" ON public.performance_report_reminders;

-- Create a single consolidated SELECT policy
CREATE POLICY "Users can view reminders"
  ON public.performance_report_reminders FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role = 'super_admin'
    )
  );

-- Create separate policies for INSERT, UPDATE, DELETE (super admin only)
CREATE POLICY "Super admin can insert reminders"
  ON public.performance_report_reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can update reminders"
  ON public.performance_report_reminders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can delete reminders"
  ON public.performance_report_reminders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role = 'super_admin'
    )
  );

-- =============================================
-- 4. FIX FUNCTION SEARCH PATH
-- =============================================

-- Fix the parameterless version of check_missing_reports
ALTER FUNCTION public.check_missing_reports() SET search_path = '';

-- =============================================
-- 5. LOGIN ATTEMPTS POLICY
-- =============================================

-- Note: The login_attempts "Anyone can insert login attempts" policy
-- is intentionally permissive to allow tracking of failed login attempts
-- before authentication occurs. This is a necessary security monitoring
-- feature and is not considered a vulnerability in this context.