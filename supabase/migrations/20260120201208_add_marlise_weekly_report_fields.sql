/*
  # Add Weekly - Marlise Report Fields

  1. Changes
    - Add new_orders_entered field (integer, nullable) to weekly_performance_reports table
    - Add number_of_files_stacked field (integer, nullable) to weekly_performance_reports table
    - Add nos_sent field (integer, nullable) to weekly_performance_reports table
  
  2. Notes
    - These fields are nullable because they are specific to the 'Weekly - Marlise' report type
    - Other report types will not use these fields
*/

-- Add new fields for Weekly - Marlise report
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_performance_reports' AND column_name = 'new_orders_entered'
  ) THEN
    ALTER TABLE weekly_performance_reports ADD COLUMN new_orders_entered integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_performance_reports' AND column_name = 'number_of_files_stacked'
  ) THEN
    ALTER TABLE weekly_performance_reports ADD COLUMN number_of_files_stacked integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_performance_reports' AND column_name = 'nos_sent'
  ) THEN
    ALTER TABLE weekly_performance_reports ADD COLUMN nos_sent integer DEFAULT 0;
  END IF;
END $$;
