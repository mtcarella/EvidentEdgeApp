-- Part 2: Replace USING (true) with role/ownership predicates
-- Strategy: keep app-functional read access for active sales_people, but
-- remove unconditional public reads on financial / audit / config tables.

-- audit_logs: only admins and super-admins can read or insert.
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
        AND sp.role IN ('admin','super_admin')
        AND sp.is_active = true
    )
  );

-- verified_wires: financial PII, restrict reads to admins / processors / super-admins.
DROP POLICY IF EXISTS "Authenticated users can view verified wires" ON verified_wires;
CREATE POLICY "Privileged staff can view verified wires" ON verified_wires
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
        AND sp.role IN ('admin','processor','super_admin','sales_processor')
        AND sp.is_active = true
    )
  );

-- shared_contact_access: only the involved viewer/owner or admins.
DROP POLICY IF EXISTS "Anyone can read shared access" ON shared_contact_access;
CREATE POLICY "Involved parties or admins can read shared access" ON shared_contact_access
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR salesperson_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
        AND sp.role IN ('admin','super_admin')
        AND sp.is_active = true
    )
  );

-- user_groups: drop the open-to-all SELECT (admin SELECT policy already exists for admins).
DROP POLICY IF EXISTS "All users can view user groups" ON user_groups;
CREATE POLICY "Active staff can view user groups" ON user_groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid() AND sp.is_active = true
    )
  );

-- system_settings: settings drive UI feature flags, but require active staff to read.
DROP POLICY IF EXISTS "All authenticated users can read system settings" ON system_settings;
CREATE POLICY "Active staff can read system settings" ON system_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid() AND sp.is_active = true
    )
  );

-- contacts: all sales staff need to query contacts for the contact-search workflow,
-- but require active sales_people record.
DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
CREATE POLICY "Active staff can view contacts" ON contacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid() AND sp.is_active = true
    )
  );

-- assignments: same pattern.
DROP POLICY IF EXISTS "Users can view assignments" ON assignments;
CREATE POLICY "Active staff can view assignments" ON assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid() AND sp.is_active = true
    )
  );

-- conversation_participants: caller may only add themselves, or add anyone if caller
-- is already in the conversation, or is admin/super_admin.
DROP POLICY IF EXISTS "Users can add participants to conversations" ON conversation_participants;
CREATE POLICY "Caller may add self or as participant or as admin"
  ON conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.user_is_conversation_participant(conversation_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
        AND sp.role IN ('admin','super_admin')
        AND sp.is_active = true
    )
  );
