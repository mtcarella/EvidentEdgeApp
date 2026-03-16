/*
  # Create SMS Opt-In System

  1. New Tables
    - `sms_opt_ins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `phone_number` (text)
      - `opted_in` (boolean, default true)
      - `consent_timestamp` (timestamptz)
      - `opt_out_timestamp` (timestamptz, nullable)
      - `ip_address` (text, nullable) - for compliance tracking
      - `user_agent` (text, nullable) - for compliance tracking
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `sms_opt_ins` table
    - Users can only view and manage their own opt-in records
    - Admins and super admins can view all opt-in records

  3. Indexes
    - Add index on user_id for faster lookups
    - Add index on phone_number for quick searches
    - Add index on opted_in status for filtering
*/

CREATE TABLE IF NOT EXISTS sms_opt_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  opted_in boolean DEFAULT true,
  consent_timestamp timestamptz NOT NULL DEFAULT now(),
  opt_out_timestamp timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_opt_ins_user_id ON sms_opt_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_opt_ins_phone_number ON sms_opt_ins(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_opt_ins_opted_in ON sms_opt_ins(opted_in);

-- Enable RLS
ALTER TABLE sms_opt_ins ENABLE ROW LEVEL SECURITY;

-- Users can view their own opt-in records
CREATE POLICY "Users can view own SMS opt-in records"
  ON sms_opt_ins FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Users can insert their own opt-in records
CREATE POLICY "Users can create own SMS opt-in records"
  ON sms_opt_ins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own opt-in records (to opt-out)
CREATE POLICY "Users can update own SMS opt-in records"
  ON sms_opt_ins FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can delete opt-in records if needed for compliance
CREATE POLICY "Admins can delete SMS opt-in records"
  ON sms_opt_ins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_sms_opt_ins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sms_opt_ins_updated_at
  BEFORE UPDATE ON sms_opt_ins
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_opt_ins_updated_at();