/*
  # Add expense payment method field

  1. Changes
    - Add `expense_payment_method` column to the `meetings` table
      - `expense_payment_method` (text, nullable) - tracks payment method: 'personal' or 'company'
  
  2. Notes
    - Field is nullable to maintain backward compatibility
    - Only relevant when has_expense is true
*/

-- Add expense_payment_method column to meetings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings' AND column_name = 'expense_payment_method'
  ) THEN
    ALTER TABLE meetings ADD COLUMN expense_payment_method text;
  END IF;
END $$;