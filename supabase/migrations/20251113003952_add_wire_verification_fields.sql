/*
  # Add Wire Verification Additional Fields

  1. Changes to `wire_verification_logs` table
    - Add `reason_for_wire` (text) - The purpose of the wire transfer
    - Add `property_address` (text) - Property address for most wire types
    - Add `seller_name` (text) - For seller proceeds wires
    - Add `loan_number_additional` (text) - Additional loan number for certain wire types
    - Add `agent_type` (text) - For commission wires (buyers_agent or sellers_agent)
    - Add `further_credit_to` (text) - For brokerage account wires
    - Add `borrower_name` (text) - For returned wire
    - Add `buyer_name` (text) - For returned deposit and buyer excess funds

  2. Notes
    - All new fields are nullable since different wire types require different fields
    - reason_for_wire has a constraint to ensure valid values
*/

-- Add new columns to wire_verification_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wire_verification_logs' AND column_name = 'reason_for_wire'
  ) THEN
    ALTER TABLE wire_verification_logs ADD COLUMN reason_for_wire text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wire_verification_logs' AND column_name = 'property_address'
  ) THEN
    ALTER TABLE wire_verification_logs ADD COLUMN property_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wire_verification_logs' AND column_name = 'seller_name'
  ) THEN
    ALTER TABLE wire_verification_logs ADD COLUMN seller_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wire_verification_logs' AND column_name = 'loan_number_additional'
  ) THEN
    ALTER TABLE wire_verification_logs ADD COLUMN loan_number_additional text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wire_verification_logs' AND column_name = 'agent_type'
  ) THEN
    ALTER TABLE wire_verification_logs ADD COLUMN agent_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wire_verification_logs' AND column_name = 'further_credit_to'
  ) THEN
    ALTER TABLE wire_verification_logs ADD COLUMN further_credit_to text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wire_verification_logs' AND column_name = 'borrower_name'
  ) THEN
    ALTER TABLE wire_verification_logs ADD COLUMN borrower_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wire_verification_logs' AND column_name = 'buyer_name'
  ) THEN
    ALTER TABLE wire_verification_logs ADD COLUMN buyer_name text;
  END IF;
END $$;

-- Add constraint to reason_for_wire to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wire_verification_logs_reason_for_wire_check'
  ) THEN
    ALTER TABLE wire_verification_logs
    ADD CONSTRAINT wire_verification_logs_reason_for_wire_check
    CHECK (reason_for_wire IN (
      'seller_proceeds',
      'payoff',
      'commission',
      'brokerage_account',
      'returned_wire',
      'returned_deposit',
      'buyer_excess_funds'
    ));
  END IF;
END $$;

-- Add constraint to agent_type to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wire_verification_logs_agent_type_check'
  ) THEN
    ALTER TABLE wire_verification_logs
    ADD CONSTRAINT wire_verification_logs_agent_type_check
    CHECK (agent_type IN ('buyers_agent', 'sellers_agent') OR agent_type IS NULL);
  END IF;
END $$;