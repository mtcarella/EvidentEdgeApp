/*
  # Comprehensive Security and Performance Fixes

  This migration addresses multiple categories of security and performance issues:

  ## 1. Foreign Key Indexes (7 new indexes)
    - Add indexes for foreign keys to improve query performance:
      - announcements.created_by
      - communication_logs.group_id  
      - user_groups.created_by
      - verified_wires.created_by
      - weekly_performance_reports.processor_id
      - wire_verification_logs.created_by
      - wire_verification_logs.verified_wire_id

  ## 2. Remove Unused Indexes (12 indexes)
    - Drop indexes that are not being used to reduce maintenance overhead

  ## 3. Fix RLS Policy Performance (40+ policies)
    - Replace `auth.<function>()` with `(select auth.<function>())` to prevent re-evaluation per row
    - Affects tables: meetings, resources, weekly_performance_reports, user_module_permissions,
      performance_report_reminders, announcements, announcement_reads, user_groups,
      user_group_members, communication_logs

  ## 4. Consolidate Multiple Permissive Policies (3 tables)
    - Combine multiple SELECT policies into single policies for:
      - announcements
      - performance_report_reminders
      - sales_people (INSERT)

  ## 5. Fix Function Search Paths (8 functions)
    - Set immutable search_path for security functions

  ## 6. Fix Always-True RLS Policies (2 policies)
    - Add proper restrictions to overly permissive policies
*/

-- =============================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_communication_logs_group_id ON public.communication_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_created_by ON public.user_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_verified_wires_created_by ON public.verified_wires(created_by);
CREATE INDEX IF NOT EXISTS idx_weekly_performance_reports_processor_id ON public.weekly_performance_reports(processor_id);
CREATE INDEX IF NOT EXISTS idx_wire_verification_logs_created_by ON public.wire_verification_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_wire_verification_logs_verified_wire_id ON public.wire_verification_logs(verified_wire_id);

-- =============================================
-- 2. DROP UNUSED INDEXES
-- =============================================

DROP INDEX IF EXISTS idx_announcements_category;
DROP INDEX IF EXISTS idx_user_group_members_user_id;
DROP INDEX IF EXISTS idx_communication_logs_sent_by;
DROP INDEX IF EXISTS idx_user_module_permissions_granted_by;
DROP INDEX IF EXISTS idx_contacts_created_by;
DROP INDEX IF EXISTS idx_resources_uploaded_by;
DROP INDEX IF EXISTS idx_shared_contact_access_created_by;
DROP INDEX IF EXISTS idx_shared_contact_access_salesperson_id;
DROP INDEX IF EXISTS idx_performance_report_reminders_pending;
DROP INDEX IF EXISTS idx_contacts_first_name;
DROP INDEX IF EXISTS idx_contacts_last_name;
DROP INDEX IF EXISTS idx_meetings_group_id;

-- =============================================
-- 3. FIX RLS POLICIES - MEETINGS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view their own meetings or admins view all" ON public.meetings;
DROP POLICY IF EXISTS "Users can log meetings based on role" ON public.meetings;
DROP POLICY IF EXISTS "Users can update their own meetings or admins update all" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings or admins delete all" ON public.meetings;

CREATE POLICY "Users can view their own meetings or admins view all"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND (
        sales_people.role IN ('super_admin', 'admin', 'processor', 'sales_processor')
        OR meetings.salesperson_id = sales_people.id
      )
    )
  );

CREATE POLICY "Users can log meetings based on role"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = (select auth.uid())
      AND (
        sp.role IN ('super_admin', 'admin', 'processor', 'sales_processor')
        OR sp.id = salesperson_id
      )
    )
  );

CREATE POLICY "Users can update their own meetings or admins update all"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND (
        sales_people.role IN ('super_admin', 'admin', 'processor', 'sales_processor')
        OR meetings.salesperson_id = sales_people.id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND (
        sales_people.role IN ('super_admin', 'admin', 'processor', 'sales_processor')
        OR meetings.salesperson_id = sales_people.id
      )
    )
  );

CREATE POLICY "Users can delete their own meetings or admins delete all"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND (
        sales_people.role IN ('super_admin', 'admin')
        OR meetings.salesperson_id = sales_people.id
      )
    )
  );

-- =============================================
-- 4. FIX RLS POLICIES - RESOURCES TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view resources based on role" ON public.resources;
DROP POLICY IF EXISTS "Admins can insert resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can update resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can delete resources" ON public.resources;

CREATE POLICY "Users can view resources based on role"
  ON public.resources FOR SELECT
  TO authenticated
  USING (
    category != 'administration' OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert resources"
  ON public.resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update resources"
  ON public.resources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete resources"
  ON public.resources FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

-- =============================================
-- 5. FIX RLS POLICIES - WEEKLY_PERFORMANCE_REPORTS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view reports" ON public.weekly_performance_reports;
DROP POLICY IF EXISTS "Users can insert reports" ON public.weekly_performance_reports;
DROP POLICY IF EXISTS "Users can update reports" ON public.weekly_performance_reports;
DROP POLICY IF EXISTS "Admins can delete reports" ON public.weekly_performance_reports;

CREATE POLICY "Users can view reports"
  ON public.weekly_performance_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = (select auth.uid())
      AND (
        sp.role IN ('super_admin', 'admin', 'processor', 'sales_processor')
        OR (sp.id = processor_id)
      )
    )
    OR EXISTS (
      SELECT 1 FROM user_module_permissions ump
      WHERE ump.user_id = (select auth.uid())
      AND ump.module_name = 'view_daily_reports'
      AND ump.has_access = true
    )
  );

CREATE POLICY "Users can insert reports"
  ON public.weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update reports"
  ON public.weekly_performance_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = (select auth.uid())
      AND (
        sp.role IN ('super_admin', 'admin')
        OR sp.id = processor_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = (select auth.uid())
      AND (
        sp.role IN ('super_admin', 'admin')
        OR sp.id = processor_id
      )
    )
  );

CREATE POLICY "Admins can delete reports"
  ON public.weekly_performance_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

-- =============================================
-- 6. FIX RLS POLICIES - USER_MODULE_PERMISSIONS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view module permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Admins can insert module permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Admins can update module permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Admins can delete module permissions" ON public.user_module_permissions;

CREATE POLICY "Users can view module permissions"
  ON public.user_module_permissions FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert module permissions"
  ON public.user_module_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update module permissions"
  ON public.user_module_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete module permissions"
  ON public.user_module_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

-- =============================================
-- 7. FIX RLS POLICIES - PERFORMANCE_REPORT_REMINDERS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view own reminders" ON public.performance_report_reminders;
DROP POLICY IF EXISTS "Super admin can manage all reminders" ON public.performance_report_reminders;

-- Consolidate into single SELECT policy
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

CREATE POLICY "Super admin can manage reminders"
  ON public.performance_report_reminders FOR ALL
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

-- =============================================
-- 8. FIX RLS POLICIES - ANNOUNCEMENTS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view active announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can view all announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can create announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;

-- Consolidate SELECT policies
CREATE POLICY "Users can view announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND (expires_at IS NULL OR expires_at > now()))
    OR EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can create announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

-- =============================================
-- 9. FIX RLS POLICIES - ANNOUNCEMENT_READS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view own read receipts" ON public.announcement_reads;
DROP POLICY IF EXISTS "Users can mark announcements as read" ON public.announcement_reads;
DROP POLICY IF EXISTS "Users can delete own read receipts" ON public.announcement_reads;

CREATE POLICY "Users can view own read receipts"
  ON public.announcement_reads FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can mark announcements as read"
  ON public.announcement_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own read receipts"
  ON public.announcement_reads FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =============================================
-- 10. FIX RLS POLICIES - USER_GROUPS TABLE
-- =============================================

DROP POLICY IF EXISTS "Admins can view all user groups" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can create user groups" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can update user groups" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can delete user groups" ON public.user_groups;

CREATE POLICY "Admins can view all user groups"
  ON public.user_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can create user groups"
  ON public.user_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update user groups"
  ON public.user_groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete user groups"
  ON public.user_groups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

-- =============================================
-- 11. FIX RLS POLICIES - USER_GROUP_MEMBERS TABLE
-- =============================================

DROP POLICY IF EXISTS "Admins can view all group members" ON public.user_group_members;
DROP POLICY IF EXISTS "Admins can add group members" ON public.user_group_members;
DROP POLICY IF EXISTS "Admins can remove group members" ON public.user_group_members;

CREATE POLICY "Admins can view all group members"
  ON public.user_group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can add group members"
  ON public.user_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can remove group members"
  ON public.user_group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

-- =============================================
-- 12. FIX RLS POLICIES - COMMUNICATION_LOGS TABLE
-- =============================================

DROP POLICY IF EXISTS "Admins can view all communication logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Admins can create communication logs" ON public.communication_logs;

CREATE POLICY "Admins can view all communication logs"
  ON public.communication_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can create communication logs"
  ON public.communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

-- =============================================
-- 13. FIX RLS POLICIES - SALES_PEOPLE TABLE (Consolidate INSERT policies)
-- =============================================

DROP POLICY IF EXISTS "Admins can insert salespeople" ON public.sales_people;
DROP POLICY IF EXISTS "Users can insert during signup" ON public.sales_people;

-- Consolidate both INSERT policies into one
CREATE POLICY "Users can insert salespeople"
  ON public.sales_people FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = (select auth.uid())
      AND sp.role IN ('super_admin', 'admin')
    )
  );

-- =============================================
-- 14. FIX FUNCTION SEARCH PATHS
-- =============================================

-- Functions with no parameters
ALTER FUNCTION public.update_announcement_updated_at() SET search_path = '';
ALTER FUNCTION public.mark_reminder_as_submitted() SET search_path = '';
ALTER FUNCTION public.sync_contact_name() SET search_path = '';
ALTER FUNCTION public.trigger_reminder_emails() SET search_path = '';

-- Functions with parameters - need to specify the signature
ALTER FUNCTION public.check_missing_reports(text) SET search_path = '';
ALTER FUNCTION public.get_users_needing_reminders(text) SET search_path = '';
ALTER FUNCTION public.proper_name_case(text) SET search_path = '';
ALTER FUNCTION public.parse_contact_name(text) SET search_path = '';

-- =============================================
-- 15. FIX ALWAYS-TRUE RLS POLICIES
-- =============================================

-- Fix audit_logs - restrict to admins only (triggers will still work)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

-- Fix contacts - require user to be authenticated salesperson
DROP POLICY IF EXISTS "Users can insert contacts" ON public.contacts;

CREATE POLICY "Users can insert contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = (select auth.uid())
    )
  );

-- Note: login_attempts table policy remains intentionally permissive
-- This is by design to track failed login attempts before authentication