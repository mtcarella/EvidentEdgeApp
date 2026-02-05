/*
  # Split Files Recorded into Three Separate Fields

  1. Changes
    - Add three new fields for recording report:
      - `deeds_recorded` (integer) - Number of Deeds Recorded
      - `mtg_recorded` (integer) - Number of Mortgages Recorded  
      - `nos_recorded` (integer) - Number of NOS Recorded
    - Keep the old `files_recorded` field for backward compatibility but it won't be used going forward

  2. Notes
    - New fields default to 0
    - Old data in `files_recorded` remains intact
*/

-- Add the three new recording fields
ALTER TABLE weekly_performance_reports
ADD COLUMN IF NOT EXISTS deeds_recorded integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS mtg_recorded integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS nos_recorded integer DEFAULT 0;