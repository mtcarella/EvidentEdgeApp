/*
  # Add Marketing Points to Contacts
  
  ## Changes
  - Add marketing_points column to contacts table
  - This is an integer field that all users can edit
  - Default value is 0
  
  ## Security
  - All authenticated users can view and edit this field
  - No special permissions required
*/

-- Add marketing_points column to contacts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'marketing_points'
  ) THEN
    ALTER TABLE contacts ADD COLUMN marketing_points integer DEFAULT 0;
  END IF;
END $$;
