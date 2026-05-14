/*
  # Add Global Contact Support

  1. Schema Changes
    - Add `is_global` boolean column to `contacts` table with default false
    - This allows certain contacts to be visible to all users regardless of assignment

  2. Data Updates
    - Mark the "Administrative Expenses" contact as global
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE contacts ADD COLUMN is_global boolean DEFAULT false;
  END IF;
END $$;

UPDATE contacts 
SET is_global = true 
WHERE first_name = 'Administrative' AND last_name = 'Expenses';