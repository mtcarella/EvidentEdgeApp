/*
  # Add resolved_issues column for daily reports

  1. Changes
    - Add `resolved_issues` column to weekly_performance_reports table
    - This field is used by daily reports to track resolved issues
    - The table already has `issues_resolved` for paralegal reports
    - This adds a separate field for consistency with the daily report type

  2. Notes
    - Default to empty string to match other text columns
    - This fixes the error "could not find the 'resolved_issues' column"
*/

-- Add resolved_issues column for daily reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_performance_reports' 
    AND column_name = 'resolved_issues'
  ) THEN
    ALTER TABLE weekly_performance_reports 
    ADD COLUMN resolved_issues text DEFAULT '';
  END IF;
END $$;
