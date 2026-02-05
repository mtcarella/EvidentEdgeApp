/*
  # Add Multiple Report Types to Weekly Performance Reports

  1. Changes
    - Add `report_type` column to support 4 different report types:
      - 'paralegal' (existing fields)
      - 'recording' (new fields)
      - 'title' (new fields)
      - 'post_closing' (new fields)

    - Add new fields for Recording Report:
      - `files_recorded` (integer) - Number of Files Recorded
      - `oldest_file_recorded` (text) - Oldest File to be Recorded
      - `post_closing_recordings_date` (date) - Current Date of Post Closing Recordings
      - `nos_recordings_date` (date) - Current Date of NOS Recordings
      - `policies_completed` (integer) - Number of Policies completed
      - `done_printed_mailed` (integer) - Number Done/Printed/Mailed
      - `policies_sent_kathy` (integer) - Number of Policies sent for Kathy
      - `outstanding_issues_recording` (text) - Outstanding issues

    - Add new fields for Title Report:
      - `purchases_read` (integer) - Purchases Read
      - `refinances_read` (integer) - Refinances Read
      - `endorsements` (integer) - Endorsements
      - `title_reports` (integer) - Title Reports
      - `policies` (integer) - Policies
      - `construction_rds` (integer) - Construction Rd's
      - `sale_doc_preps` (integer) - Sale Doc Preps
      - `unresolved_issues_title` (text) - Unresolved Issues
      - `resolved_issues_title` (text) - Resolved Issues

    - Add new fields for Post Closing Report:
      - `policies_sent` (integer) - Number of Policies Sent
      - `save_closed_completed` (integer) - Number of Save and Closed Completed
      - `searches_past_due` (text) - Any Searches past due and why
      - `reissued_mail_returned` (integer) - Number Reissued & Mail Returned Check Sent out
      - `escrow_released` (integer) - Number of Escrow released
      - `unresolved_issues_post` (text) - Unresolved Issues
      - `pending_policies` (text) - Pending Policies

  2. Notes
    - All new fields have appropriate defaults
    - Existing reports will default to 'paralegal' type
    - Each report type has its own set of fields
*/

-- Add report_type column with default 'paralegal' for existing records
ALTER TABLE weekly_performance_reports
ADD COLUMN IF NOT EXISTS report_type text DEFAULT 'paralegal' NOT NULL;

-- Add constraint to ensure valid report types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_report_type'
  ) THEN
    ALTER TABLE weekly_performance_reports
    ADD CONSTRAINT valid_report_type
    CHECK (report_type IN ('paralegal', 'recording', 'title', 'post_closing'));
  END IF;
END $$;

-- Recording Report fields
ALTER TABLE weekly_performance_reports
ADD COLUMN IF NOT EXISTS files_recorded integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS oldest_file_recorded text DEFAULT '',
ADD COLUMN IF NOT EXISTS post_closing_recordings_date date,
ADD COLUMN IF NOT EXISTS nos_recordings_date date,
ADD COLUMN IF NOT EXISTS policies_completed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS done_printed_mailed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS policies_sent_kathy integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS outstanding_issues_recording text DEFAULT '';

-- Title Report fields
ALTER TABLE weekly_performance_reports
ADD COLUMN IF NOT EXISTS purchases_read integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS refinances_read integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS endorsements integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS title_reports integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS policies integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS construction_rds integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sale_doc_preps integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS unresolved_issues_title text DEFAULT '',
ADD COLUMN IF NOT EXISTS resolved_issues_title text DEFAULT '';

-- Post Closing Report fields
ALTER TABLE weekly_performance_reports
ADD COLUMN IF NOT EXISTS policies_sent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS save_closed_completed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS searches_past_due text DEFAULT '',
ADD COLUMN IF NOT EXISTS reissued_mail_returned integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS escrow_released integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS unresolved_issues_post text DEFAULT '',
ADD COLUMN IF NOT EXISTS pending_policies text DEFAULT '';

-- Add index on report_type for filtering
CREATE INDEX IF NOT EXISTS idx_weekly_reports_type ON weekly_performance_reports(report_type);
