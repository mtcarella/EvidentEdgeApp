/*
  # Create Verified Wires Tables

  1. New Tables
    - `verified_wires`
      - `id` (uuid, primary key)
      - `bank_name` (text, required) - Name of the bank
      - `routing_number` (text, required) - Bank routing number
      - `account_number` (text, required) - Bank account number
      - `approved_by` (text, required) - Name of person who approved
      - `date_approved` (date, required) - Date of approval
      - `created_at` (timestamptz) - Record creation timestamp
      - `created_by` (uuid) - User who created the record
      
    - `wire_verification_logs`
      - `id` (uuid, primary key)
      - `routing_number` (text, required) - Routing number searched
      - `account_number` (text, required) - Account number searched
      - `file_number` (text, required) - File number entered by user
      - `loan_number` (text, required) - Loan number entered by user
      - `match_found` (boolean, required) - Whether a match was found
      - `verified_wire_id` (uuid, nullable) - FK to verified_wires if match found
      - `created_by` (uuid, required) - User who performed the search
      - `created_at` (timestamptz) - When the search was performed
      
  2. Security
    - Enable RLS on both tables
    - Admins and processors can read all verified wires
    - Admins and processors can insert new verified wires
    - Only admins can view verification logs
    - All authenticated users can create verification logs (for their searches)
*/

-- Create verified_wires table
CREATE TABLE IF NOT EXISTS verified_wires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  routing_number text NOT NULL,
  account_number text NOT NULL,
  approved_by text NOT NULL,
  date_approved date NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create wire_verification_logs table
CREATE TABLE IF NOT EXISTS wire_verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routing_number text NOT NULL,
  account_number text NOT NULL,
  file_number text NOT NULL,
  loan_number text NOT NULL,
  match_found boolean NOT NULL DEFAULT false,
  verified_wire_id uuid REFERENCES verified_wires(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_verified_wires_routing_account 
  ON verified_wires(routing_number, account_number);

CREATE INDEX IF NOT EXISTS idx_wire_logs_created_at 
  ON wire_verification_logs(created_at DESC);

-- Enable RLS
ALTER TABLE verified_wires ENABLE ROW LEVEL SECURITY;
ALTER TABLE wire_verification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for verified_wires
CREATE POLICY "Admins and processors can view verified wires"
  ON verified_wires FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
  );

CREATE POLICY "Admins and processors can insert verified wires"
  ON verified_wires FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'processor')
    )
  );

-- RLS Policies for wire_verification_logs
CREATE POLICY "Admins can view all verification logs"
  ON wire_verification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can create verification logs"
  ON wire_verification_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
  );

-- Add audit triggers
DROP TRIGGER IF EXISTS audit_verified_wires ON verified_wires;
CREATE TRIGGER audit_verified_wires
  AFTER INSERT OR UPDATE OR DELETE ON verified_wires
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_wire_verification_logs ON wire_verification_logs;
CREATE TRIGGER audit_wire_verification_logs
  AFTER INSERT OR UPDATE OR DELETE ON wire_verification_logs
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
