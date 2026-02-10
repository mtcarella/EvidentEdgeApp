/*
  # Add cell phone field to sales_people table

  1. Changes
    - Add `cell_phone` column to `sales_people` table
      - Type: text (nullable)
      - Will store formatted cell phone numbers for SMS notifications
  
  2. Notes
    - Field is optional to accommodate users who don't want SMS notifications
    - Should be formatted as E.164 format for SMS services (e.g., +12345678900)
*/

-- Add cell_phone column to sales_people table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_people' AND column_name = 'cell_phone'
  ) THEN
    ALTER TABLE sales_people ADD COLUMN cell_phone text;
  END IF;
END $$;
