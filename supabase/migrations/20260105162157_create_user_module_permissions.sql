/*
  # Create User Module Permissions System

  1. New Tables
    - `user_module_permissions`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - References sales_people.id
      - `module_name` (text) - Name of the module
      - `has_access` (boolean) - Whether user has access to this module
      - `created_at` (timestamptz) - When permission was created
      - `updated_at` (timestamptz) - When permission was last updated
      - `granted_by` (uuid) - Which admin granted this permission (references sales_people.user_id)

  2. Security
    - Enable RLS on user_module_permissions table
    - Only admins and super_admins can modify permissions
    - Users can view their own permissions
    - Admins and super_admins can view all permissions

  3. Initial Data
    - Auto-populate permissions for all existing users based on their current roles
    - Available modules:
      - dashboard (all users)
      - add_prospect (salesperson, admin, super_admin)
      - my_contacts (salesperson, admin, super_admin)
      - contact_search (admin, super_admin)
      - incoming_wires (processor, sales_processor, admin, super_admin)
      - verify_wires (processor, sales_processor, admin, super_admin)
      - closer_submissions (closer, admin, super_admin)
      - closer_rewards_report (admin, super_admin)
      - weekly_reports (processor, sales_processor, closer, admin, super_admin)
      - meeting_logs_report (admin, super_admin)
      - admin_panel (admin, super_admin)
      - audit_log (super_admin)
      - import_data (admin, super_admin)
      - resources (all users)
      - conflict_check (all users)
*/

-- Create user_module_permissions table
CREATE TABLE IF NOT EXISTS user_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  has_access boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, module_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_user_id ON user_module_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_module_name ON user_module_permissions(module_name);

-- Enable RLS
ALTER TABLE user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own permissions
CREATE POLICY "Users can view own module permissions"
  ON user_module_permissions FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own permissions
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = user_module_permissions.user_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.is_active = true
    )
    OR
    -- Admins and super_admins can see all permissions
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Only admins and super_admins can insert permissions
CREATE POLICY "Admins can insert module permissions"
  ON user_module_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Only admins and super_admins can update permissions
CREATE POLICY "Admins can update module permissions"
  ON user_module_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Only admins and super_admins can delete permissions
CREATE POLICY "Admins can delete module permissions"
  ON user_module_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_module_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_module_permissions_updated_at_trigger
  BEFORE UPDATE ON user_module_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_module_permissions_updated_at();

-- Initialize permissions for all existing users based on their roles
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  sp.id,
  module,
  true
FROM sales_people sp
CROSS JOIN (
  SELECT 'dashboard' as module
  UNION ALL SELECT 'add_prospect'
  UNION ALL SELECT 'my_contacts'
  UNION ALL SELECT 'contact_search'
  UNION ALL SELECT 'incoming_wires'
  UNION ALL SELECT 'verify_wires'
  UNION ALL SELECT 'closer_submissions'
  UNION ALL SELECT 'closer_rewards_report'
  UNION ALL SELECT 'weekly_reports'
  UNION ALL SELECT 'meeting_logs_report'
  UNION ALL SELECT 'admin_panel'
  UNION ALL SELECT 'audit_log'
  UNION ALL SELECT 'import_data'
  UNION ALL SELECT 'resources'
  UNION ALL SELECT 'conflict_check'
) modules
WHERE 
  -- Dashboard, Resources, Conflict Check available to all
  (module IN ('dashboard', 'resources', 'conflict_check'))
  OR
  -- Add Prospect and My Contacts for salesperson, admin, super_admin
  (module IN ('add_prospect', 'my_contacts') AND sp.role IN ('salesperson', 'admin', 'super_admin'))
  OR
  -- Contact Search for admin, super_admin
  (module = 'contact_search' AND sp.role IN ('admin', 'super_admin'))
  OR
  -- Incoming/Verify Wires for processor, sales_processor, admin, super_admin
  (module IN ('incoming_wires', 'verify_wires') AND sp.role IN ('processor', 'sales_processor', 'admin', 'super_admin'))
  OR
  -- Closer Submissions for closer, admin, super_admin
  (module = 'closer_submissions' AND sp.role IN ('closer', 'admin', 'super_admin'))
  OR
  -- Closer Rewards Report for admin, super_admin
  (module = 'closer_rewards_report' AND sp.role IN ('admin', 'super_admin'))
  OR
  -- Weekly Reports for processor, sales_processor, closer, admin, super_admin
  (module = 'weekly_reports' AND sp.role IN ('processor', 'sales_processor', 'closer', 'admin', 'super_admin'))
  OR
  -- Meeting Logs Report for admin, super_admin
  (module = 'meeting_logs_report' AND sp.role IN ('admin', 'super_admin'))
  OR
  -- Admin Panel for admin, super_admin
  (module = 'admin_panel' AND sp.role IN ('admin', 'super_admin'))
  OR
  -- Audit Log for super_admin only
  (module = 'audit_log' AND sp.role = 'super_admin')
  OR
  -- Import Data for admin, super_admin
  (module = 'import_data' AND sp.role IN ('admin', 'super_admin'))
ON CONFLICT (user_id, module_name) DO NOTHING;
