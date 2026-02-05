/*
  # Add cell phone field to contacts

  1. Changes
    - Add `cell_phone` column to `contacts` table
      - Type: text (nullable)
      - Will store formatted cell phone numbers separately from main phone number
  
  2. Notes
    - Existing phone field remains unchanged
    - Cell phone field follows same formatting rules as phone field
    - Both fields are optional to accommodate various contact types
*/

-- Add cell_phone column to contacts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'cell_phone'
  ) THEN
    ALTER TABLE contacts ADD COLUMN cell_phone text;
  END IF;
END $$;