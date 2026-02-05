/*
  # Add Report Requirement Fields

  1. Changes
    - Add `requires_daily_reports` column to `sales_people` table
      - Type: boolean
      - Default: false
      - Description: Indicates if user is required to submit daily reports
    - Add `requires_weekly_reports` column to `sales_people` table
      - Type: boolean
      - Default: false
      - Description: Indicates if user is required to submit weekly reports
  
  2. Notes
    - These fields will be used to determine which users receive report reminders
    - Admins and super admins can configure these settings per user
    - The reminder system will check these flags before sending notifications
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_people' AND column_name = 'requires_daily_reports'
  ) THEN
    ALTER TABLE sales_people 
    ADD COLUMN requires_daily_reports boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_people' AND column_name = 'requires_weekly_reports'
  ) THEN
    ALTER TABLE sales_people 
    ADD COLUMN requires_weekly_reports boolean DEFAULT false;
  END IF;
END $$;
