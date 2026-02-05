/*
  # Add Number of Post Closings Field

  1. Changes
    - Add `number_of_post_closings` column to `weekly_performance_reports` table
      - Type: integer
      - Nullable: true
      - Description: Tracks the number of post closings in paralegal & post closing reports
  
  2. Notes
    - This field is only used for paralegal_post_closing report type
    - Will be displayed in the Post Closing Metrics section
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_performance_reports' AND column_name = 'number_of_post_closings'
  ) THEN
    ALTER TABLE weekly_performance_reports 
    ADD COLUMN number_of_post_closings integer;
  END IF;
END $$;
