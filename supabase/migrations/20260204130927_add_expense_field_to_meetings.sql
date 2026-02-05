/*
  # Add Expense Field to Meetings Table

  1. Changes
    - Add `has_expense` column to the `meetings` table
      - `has_expense` (boolean, default false) - tracks whether there was an expense associated with this meeting
  
  2. Purpose
    - Allows tracking of meetings that incurred expenses (e.g., meals, entertainment)
    - Helps with expense reporting and reimbursement tracking
*/

-- Add has_expense column to meetings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings' AND column_name = 'has_expense'
  ) THEN
    ALTER TABLE meetings ADD COLUMN has_expense boolean DEFAULT false;
  END IF;
END $$;