/*
  # Add Marlise Report Type to Valid Report Types

  1. Changes
    - Drop the existing valid_report_type constraint
    - Add new constraint that includes 'marlise' as a valid report type
  
  2. Valid Report Types After Migration
    - 'paralegal_post_closing'
    - 'recording'
    - 'title'
    - 'daily'
    - 'marlise' (NEW)
  
  3. Notes
    - This allows users to submit "Weekly - Marlise" reports
    - The marlise report type uses fields: new_orders_entered, number_of_files_stacked, nos_sent
*/

-- Drop the existing constraint
ALTER TABLE weekly_performance_reports
DROP CONSTRAINT IF EXISTS valid_report_type;

-- Add the new constraint that includes 'marlise'
ALTER TABLE weekly_performance_reports
ADD CONSTRAINT valid_report_type
CHECK (report_type IN ('paralegal_post_closing', 'recording', 'title', 'daily', 'marlise'));
