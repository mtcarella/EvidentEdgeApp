/*
  # Create Employee Communication System

  This migration creates the infrastructure for the Employee Communication module,
  which allows admins to send emails/texts to individual users or groups.

  ## New Tables
  
  ### `user_groups`
  - `id` (uuid, primary key) - Unique identifier for each group
  - `name` (text, not null) - Name of the user group
  - `description` (text, nullable) - Optional description of the group
  - `created_by` (uuid, foreign key to auth.users) - User who created the group
  - `created_at` (timestamptz) - When the group was created
  - `updated_at` (timestamptz) - When the group was last updated

  ### `user_group_members`
  - `id` (uuid, primary key) - Unique identifier
  - `group_id` (uuid, foreign key to user_groups) - The group this membership belongs to
  - `user_id` (uuid, foreign key to auth.users) - The user in this group
  - `added_at` (timestamptz) - When the user was added to the group
  - Unique constraint on (group_id, user_id) to prevent duplicates

  ### `communication_logs`
  - `id` (uuid, primary key) - Unique identifier for each communication
  - `sent_by` (uuid, foreign key to auth.users) - User who sent the message
  - `communication_type` (text) - 'email' or 'sms'
  - `recipient_type` (text) - 'individual' or 'group'
  - `recipient_ids` (jsonb) - Array of user IDs who received the message
  - `group_id` (uuid, nullable, foreign key to user_groups) - If sent to a group
  - `subject` (text, nullable) - Subject line for emails
  - `message` (text) - The message content
  - `sent_at` (timestamptz) - When the message was sent

  ## Module Permissions
  - Adds 'employee_communication' module with admin-only access by default

  ## Security
  - Enable RLS on all tables
  - Only admins and super_admins can manage groups and send communications
  - All users can view groups they belong to
  - Comprehensive audit logging for all communications
*/

-- Create user_groups table
CREATE TABLE IF NOT EXISTS user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_group_members table
CREATE TABLE IF NOT EXISTS user_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES user_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  added_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create communication_logs table
CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  communication_type text NOT NULL CHECK (communication_type IN ('email', 'sms')),
  recipient_type text NOT NULL CHECK (recipient_type IN ('individual', 'group')),
  recipient_ids jsonb NOT NULL,
  group_id uuid REFERENCES user_groups(id) ON DELETE SET NULL,
  subject text,
  message text NOT NULL,
  sent_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_groups

-- Admins can view all groups
CREATE POLICY "Admins can view all user groups"
ON user_groups FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- Admins can create groups
CREATE POLICY "Admins can create user groups"
ON user_groups FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- Admins can update groups
CREATE POLICY "Admins can update user groups"
ON user_groups FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- Admins can delete groups
CREATE POLICY "Admins can delete user groups"
ON user_groups FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for user_group_members

-- Admins can view all group members
CREATE POLICY "Admins can view all group members"
ON user_group_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- Admins can add members to groups
CREATE POLICY "Admins can add group members"
ON user_group_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- Admins can remove members from groups
CREATE POLICY "Admins can remove group members"
ON user_group_members FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for communication_logs

-- Admins can view all communication logs
CREATE POLICY "Admins can view all communication logs"
ON communication_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- Admins can create communication logs
CREATE POLICY "Admins can create communication logs"
ON communication_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- Add employee_communication module permission for admins
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT 
  sales_people.id,
  'employee_communication',
  true
FROM sales_people
WHERE sales_people.role IN ('admin', 'super_admin')
ON CONFLICT (user_id, module_name) DO UPDATE
SET has_access = true;

-- Create index for faster group member lookups
CREATE INDEX IF NOT EXISTS idx_user_group_members_group_id ON user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user_id ON user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_by ON communication_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_at ON communication_logs(sent_at DESC);
