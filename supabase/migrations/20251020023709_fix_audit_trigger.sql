/*
  # Fix Audit Trigger Function

  1. Changes
    - Drop and recreate the audit_trigger_function with correct column names
    - The function was referencing non-existent column names
    - Correct column names are: old_data, new_data (not old_values, new_values)
  
  2. Notes
    - This fixes the error when inserting into sales_people table
    - Maintains the same audit logging functionality
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS audit_sales_people ON sales_people;
DROP TRIGGER IF EXISTS audit_contacts ON contacts;
DROP TRIGGER IF EXISTS audit_assignments ON assignments;

-- Drop and recreate the function with correct column names
DROP FUNCTION IF EXISTS audit_trigger_function();

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

-- Recreate triggers
CREATE TRIGGER audit_sales_people
  AFTER INSERT OR UPDATE OR DELETE ON sales_people
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_contacts
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_assignments
  AFTER INSERT OR UPDATE OR DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();