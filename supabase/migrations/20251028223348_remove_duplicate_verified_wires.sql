/*
  # Remove Duplicate Verified Wires and Add Unique Constraint

  1. Changes
    - Remove duplicate entries in verified_wires table
    - Keep the most recently approved entry for each routing/account combination
    - Add unique constraint to prevent future duplicates

  2. Data Integrity
    - Preserves the most recent approval date for each wire combination
    - Ensures no data loss for unique wire information
    - Prevents duplicate entries going forward

  3. Security
    - No changes to RLS policies
*/

-- Remove duplicates, keeping only the most recent entry for each routing/account combination
DELETE FROM verified_wires a
USING verified_wires b
WHERE a.id < b.id
  AND a.routing_number = b.routing_number
  AND a.account_number = b.account_number;

-- Add unique constraint to prevent future duplicates
ALTER TABLE verified_wires
ADD CONSTRAINT verified_wires_routing_account_unique
UNIQUE (routing_number, account_number);
