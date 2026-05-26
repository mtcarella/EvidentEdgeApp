/*
  # Add Driver column to contacts table

  1. Changes
    - Add `driver` boolean column to `contacts` table (default: false)
    - All existing contacts default to driver = false
    
  2. Notes
    - When a contact is marked as driver, their assigned salesperson takes
      absolute precedence over the existing hierarchy logic in search results
    - Older contacts without this field explicitly set are treated as driver = false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'driver'
  ) THEN
    ALTER TABLE contacts ADD COLUMN driver boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_driver ON contacts(driver) WHERE driver = true;
