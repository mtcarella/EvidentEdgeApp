/*
  # Add expense amount and receipt fields

  1. Changes
    - Add `expense_amount` column to the `meetings` table
      - `expense_amount` (numeric, nullable) - stores the expense amount in dollars
    - Add `receipt_url` column to the `meetings` table
      - `receipt_url` (text, nullable) - stores the storage path to the receipt file
  
  2. Notes
    - Fields are nullable to maintain backward compatibility
    - Only relevant when has_expense is true
    - receipt_url will store the Supabase storage path
*/

-- Add expense_amount column to meetings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings' AND column_name = 'expense_amount'
  ) THEN
    ALTER TABLE meetings ADD COLUMN expense_amount numeric(10, 2);
  END IF;
END $$;

-- Add receipt_url column to meetings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings' AND column_name = 'receipt_url'
  ) THEN
    ALTER TABLE meetings ADD COLUMN receipt_url text;
  END IF;
END $$;