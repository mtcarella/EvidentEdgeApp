/*
  # Create Weekly Performance Reports System

  1. New Tables
    - `weekly_performance_reports`
      - `id` (uuid, primary key) - Unique identifier for each report
      - `processor_id` (uuid, foreign key) - References the processor in sales_people table
      - `processor_name` (text) - Name of the processor (denormalized for reporting)
      - `report_date` (date) - Date of the report (editable by processor)
      - `purchased_closed` (integer, default 0) - Number of purchases closed
      - `refinances_closed` (integer, default 0) - Number of refinances closed
      - `file_count_refi` (integer, default 0) - File count for refinances
      - `file_count_purchases` (integer, default 0) - File count for purchases
      - `total_file_count` (integer, default 0) - Total file count
      - `review_complete_closing_date` (date) - Review complete closing date
      - `unresolved_issues` (text) - Description of unresolved issues
      - `issues_resolved` (text) - Description of issues resolved
      - `created_at` (timestamptz) - When the report was submitted

  2. Security
    - Enable RLS on `weekly_performance_reports` table
    - Processors can insert and view their own reports
    - Admins and super_admins can view all reports
    - Super_admins can delete reports if needed

  3. Indexes
    - Index on processor_id for filtering by processor
    - Index on report_date for date-based queries
*/

-- Create the weekly_performance_reports table
CREATE TABLE IF NOT EXISTS weekly_performance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processor_id uuid NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  processor_name text NOT NULL,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  purchased_closed integer DEFAULT 0,
  refinances_closed integer DEFAULT 0,
  file_count_refi integer DEFAULT 0,
  file_count_purchases integer DEFAULT 0,
  total_file_count integer DEFAULT 0,
  review_complete_closing_date date,
  unresolved_issues text DEFAULT '',
  issues_resolved text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_weekly_reports_processor_id ON weekly_performance_reports(processor_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_date ON weekly_performance_reports(report_date);

-- Enable RLS
ALTER TABLE weekly_performance_reports ENABLE ROW LEVEL SECURITY;

-- Processors can insert their own reports
CREATE POLICY "Processors can insert own reports"
  ON weekly_performance_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role = 'processor'
      AND sales_people.is_active = true
    )
  );

-- Processors can view their own reports, admins and super_admins can view all
CREATE POLICY "Users can view reports based on role"
  ON weekly_performance_reports FOR SELECT
  TO authenticated
  USING (
    -- Processors can view their own reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role = 'processor'
    ) OR
    -- Admins and super_admins can view all reports
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Processors can update their own reports
CREATE POLICY "Processors can update own reports"
  ON weekly_performance_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role = 'processor'
      AND sales_people.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = weekly_performance_reports.processor_id
      AND sales_people.user_id = auth.uid()
      AND sales_people.role = 'processor'
      AND sales_people.is_active = true
    )
  );

-- Super admins can delete reports if needed
CREATE POLICY "Super admins can delete reports"
  ON weekly_performance_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );
