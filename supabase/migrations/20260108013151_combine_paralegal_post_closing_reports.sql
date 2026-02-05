/*
  # Combine Paralegal and Post Closing Report Types

  1. Changes
    - Update the report_type constraint to replace 'paralegal' and 'post_closing' with 'paralegal_post_closing'
    - This allows a single report that combines both paralegal and post closing fields
    - Update existing 'paralegal' and 'post_closing' reports to 'paralegal_post_closing'

  2. Valid Report Types After Migration
    - 'paralegal_post_closing' (combined paralegal and post closing fields)
    - 'recording'
    - 'title'
    - 'daily'

  3. Notes
    - All existing paralegal and post_closing reports will be migrated to paralegal_post_closing
    - The combined report includes all fields from both original report types
    - No data is lost in this migration
*/

-- Drop the existing constraint
ALTER TABLE weekly_performance_reports
DROP CONSTRAINT IF EXISTS valid_report_type;

-- Update existing reports to use the new combined type
UPDATE weekly_performance_reports
SET report_type = 'paralegal_post_closing'
WHERE report_type IN ('paralegal', 'post_closing');

-- Add the new constraint with the combined type
ALTER TABLE weekly_performance_reports
ADD CONSTRAINT valid_report_type
CHECK (report_type IN ('paralegal_post_closing', 'recording', 'title', 'daily'));