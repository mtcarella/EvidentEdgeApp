/*
  # Add Birthday Field to Sales People

  1. Changes
    - Add `birthday` column to `sales_people` table (date type, nullable)
    - This allows tracking user birthdays to display on the dashboard alongside contact birthdays
  
  2. Notes
    - Birthday is optional (nullable) as existing users may not have this information
    - Uses DATE type to store just the date without time
*/

-- Add birthday column to sales_people table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_people' AND column_name = 'birthday'
  ) THEN
    ALTER TABLE sales_people ADD COLUMN birthday DATE;
  END IF;
END $$;