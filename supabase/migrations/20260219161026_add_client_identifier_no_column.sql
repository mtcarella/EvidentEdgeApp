/*
  # Add Client Identifier No. Field

  1. Changes
    - Add `client_identifier_no` column to `contacts` table
    - This field stores a client identifier number for contacts
    - Field is optional (nullable) text field

  2. Notes
    - No RLS changes needed as existing contact policies apply
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'client_identifier_no'
  ) THEN
    ALTER TABLE contacts ADD COLUMN client_identifier_no text;
  END IF;
END $$;