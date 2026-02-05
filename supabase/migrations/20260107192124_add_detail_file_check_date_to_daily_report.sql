/*
  # Add Detail File Check Date to Daily Reports

  1. Schema Changes
    - Add new column to `weekly_performance_reports` table:
      - `current_date_detail_file_check` (date, nullable) - For daily report: tracks the current date of detail file check
    
  2. Notes
    - This field will only be used when report_type = 'daily'
    - The field is optional and not required
    - All existing report types will continue to work as before
*/

-- Add new column for daily report detail file check date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_performance_reports' AND column_name = 'current_date_detail_file_check'
  ) THEN
    ALTER TABLE weekly_performance_reports ADD COLUMN current_date_detail_file_check date;
  END IF;
END $$;