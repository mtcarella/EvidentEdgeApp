/*
  # Add Branch Column to Contacts

  ## Changes
  1. Add `branch` column to contacts table
    - `branch` (text) - The branch/location associated with the contact
  
  ## Notes
  - Existing records will have NULL branch values initially
  - Branch information will be shown in search results and contact details
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'branch'
  ) THEN
    ALTER TABLE contacts ADD COLUMN branch text;
  END IF;
END $$;
