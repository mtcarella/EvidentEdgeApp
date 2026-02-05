/*
  # Sales Management System Schema

  ## Overview
  This migration creates a complete sales management system for tracking contacts,
  assignments, and changes. The system supports lookup by buyer, realtor, attorney,
  or lender with priority-based assignment resolution.

  ## Tables Created

  ### 1. sales_people
  - `id` (uuid, primary key) - Unique identifier for each salesperson
  - `user_id` (uuid) - Links to auth.users for authentication
  - `name` (text) - Full name of the salesperson
  - `email` (text) - Email address (unique)
  - `is_active` (boolean) - Whether the salesperson is currently active
  - `created_at` (timestamptz) - When the record was created
  - `updated_at` (timestamptz) - When the record was last updated

  ### 2. contacts
  - `id` (uuid, primary key) - Unique identifier for each contact
  - `name` (text) - Full name of the contact
  - `type` (text) - Type: 'buyer', 'realtor', 'attorney', or 'lender'
  - `email` (text) - Email address (optional)
  - `phone` (text) - Phone number (optional)
  - `company` (text) - Company name (optional)
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz) - When the record was created
  - `created_by` (uuid) - User who created the record
  - `updated_at` (timestamptz) - When the record was last updated
  - `updated_by` (uuid) - User who last updated the record

  ### 3. assignments
  - `id` (uuid, primary key) - Unique identifier for each assignment
  - `contact_id` (uuid, foreign key) - References contacts table
  - `salesperson_id` (uuid, foreign key) - References sales_people table
  - `assigned_at` (timestamptz) - When the assignment was made
  - `assigned_by` (uuid) - User who made the assignment
  - Unique constraint on (contact_id, salesperson_id)

  ### 4. audit_logs
  - `id` (uuid, primary key) - Unique identifier for each log entry
  - `table_name` (text) - Name of the table that was modified
  - `record_id` (uuid) - ID of the record that was modified
  - `action` (text) - Type of action: 'INSERT', 'UPDATE', or 'DELETE'
  - `old_data` (jsonb) - Previous state of the record (for updates/deletes)
  - `new_data` (jsonb) - New state of the record (for inserts/updates)
  - `changed_by` (uuid) - User who made the change
  - `changed_at` (timestamptz) - When the change occurred

  ## Security

  ### Row Level Security (RLS)
  All tables have RLS enabled with the following policies:

  #### sales_people
  - Authenticated users can view all active salespeople
  - Authenticated users can view their own record
  - Authenticated users can update their own record

  #### contacts
  - Authenticated users can view all contacts
  - Authenticated users can insert new contacts
  - Authenticated users can update contacts

  #### assignments
  - Authenticated users can view all assignments
  - Authenticated users can insert new assignments
  - Authenticated users can delete assignments

  #### audit_logs
  - Authenticated users can view all audit logs
  - System automatically inserts audit logs (no direct insert policy needed)

  ## Indexes
  - Contacts: indexed on name (for fast searching), type, and created_by
  - Assignments: indexed on contact_id and salesperson_id
  - Audit logs: indexed on table_name, record_id, and changed_at

  ## Important Notes
  1. All tables use UUID primary keys with automatic generation
  2. Timestamps default to current time
  3. RLS is restrictive - users must be authenticated to access data
  4. Audit logging captures all changes with before/after states
  5. Contact types are constrained to valid values
*/

-- Create sales_people table
CREATE TABLE IF NOT EXISTS sales_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('buyer', 'realtor', 'attorney', 'lender')),
  email text,
  phone text,
  company text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  salesperson_id uuid REFERENCES sales_people(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE(contact_id, salesperson_id)
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_assignments_contact ON assignments(contact_id);
CREATE INDEX IF NOT EXISTS idx_assignments_salesperson ON assignments(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at);

-- Enable Row Level Security
ALTER TABLE sales_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_people
CREATE POLICY "Authenticated users can view active salespeople"
  ON sales_people FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Users can view own record"
  ON sales_people FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own record"
  ON sales_people FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for contacts
CREATE POLICY "Authenticated users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated users can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (updated_by = auth.uid());

-- RLS Policies for assignments
CREATE POLICY "Authenticated users can view assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert assignments"
  ON assignments FOR INSERT
  TO authenticated
  WITH CHECK (assigned_by = auth.uid());

CREATE POLICY "Authenticated users can delete assignments"
  ON assignments FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for audit_logs
CREATE POLICY "Authenticated users can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_sales_people_updated_at
  BEFORE UPDATE ON sales_people
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create audit logging function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for all tables
CREATE TRIGGER audit_sales_people
  AFTER INSERT OR UPDATE OR DELETE ON sales_people
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_contacts
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_assignments
  AFTER INSERT OR UPDATE OR DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();