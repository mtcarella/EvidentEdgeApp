/*
  # Add gas_budget column and seed Gas Account contact

  1. Schema Changes
    - Add `gas_budget` column to `sales_people` (numeric, default 0)
      - Mirrors existing `budget` column for tracking gas-specific budget balance

  2. Data Seeding
    - Insert a system contact named "Gas Account" with:
      - type = 'vendor'
      - is_global = true (visible to all users with budget access via the existing global contacts query)
      - Skip insert if a contact with name "Gas Account" already exists

  3. Notes
    - The Gas Account contact functions like any other global contact
    - When a meeting is logged with this contact, the app routes the expense deduction to gas_budget instead of budget
*/

-- Add gas_budget column
ALTER TABLE sales_people
  ADD COLUMN IF NOT EXISTS gas_budget numeric NOT NULL DEFAULT 0;

-- Seed Gas Account contact (idempotent)
INSERT INTO contacts (name, type, is_global, client_type, notes)
SELECT 'Gas Account', 'vendor', true, 'prospect', 'System contact for tracking gas-related expenses against the user gas budget.'
WHERE NOT EXISTS (
  SELECT 1 FROM contacts WHERE name = 'Gas Account'
);
