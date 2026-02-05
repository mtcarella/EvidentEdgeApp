/*
  # Add Daily Report Type

  1. Schema Changes
    - Add two new columns to `weekly_performance_reports` table:
      - `what_did_you_do` (text, nullable) - For daily report: what the person accomplished
      - `what_do_you_need_help_with` (text, nullable) - For daily report: what help is needed
    
  2. Notes
    - The report_type column already supports text values, so 'daily' will work automatically
    - These new fields will only be used when report_type = 'daily'
    - All existing report types will continue to work as before
*/

-- Add new columns for daily report type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_performance_reports' AND column_name = 'what_did_you_do'
  ) THEN
    ALTER TABLE weekly_performance_reports ADD COLUMN what_did_you_do text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_performance_reports' AND column_name = 'what_do_you_need_help_with'
  ) THEN
    ALTER TABLE weekly_performance_reports ADD COLUMN what_do_you_need_help_with text;
  END IF;
END $$;