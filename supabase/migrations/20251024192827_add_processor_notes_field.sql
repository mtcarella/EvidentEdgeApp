/*
  # Add Processor Notes Field

  1. Changes
    - Add `processor_notes` (text) column to contacts table
    - This field is only visible/editable by admin and processor roles
  
  2. Notes
    - The existing `notes` field remains visible to all users
    - `processor_notes` provides a separate space for internal processor/admin notes
    - Field is nullable to allow gradual data population
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'processor_notes'
  ) THEN
    ALTER TABLE contacts ADD COLUMN processor_notes text;
  END IF;
END $$;