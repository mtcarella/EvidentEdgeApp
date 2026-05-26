/*
  # Create Prospect Requests System

  1. New Tables
    - `prospect_requests`
      - `id` (uuid, primary key)
      - `submitted_by_user_id` (uuid, FK to auth.users)
      - `submitted_by_name` (text, display name of submitter)
      - `prospect_name` (text, full name of proposed prospect)
      - `prospect_details` (jsonb, all prospect form fields)
      - `date_met` (date, when the submitter met the prospect)
      - `where_met` (text, where they met)
      - `why_good_client` (text, why they'd be a good client)
      - `additional_info` (text, optional extra info)
      - `status` (text, pending/approved/denied)
      - `admin_notes` (text, internal notes by admin)
      - `created_at` (timestamptz, auto-set)
      - `reviewed_at` (timestamptz, when decision was made)
      - `reviewed_by` (uuid, FK to auth.users, who decided)

  2. Security
    - Enable RLS on `prospect_requests`
    - Users can view their own requests
    - Super admins can view all requests
    - Authenticated users can insert their own requests
    - Super admins can update any request
    - Super admins can delete requests

  3. Indexes
    - status (for filtering pending/approved/denied)
    - submitted_by_user_id (for user's own requests)
    - created_at (for ordering)
*/

CREATE TABLE IF NOT EXISTS prospect_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by_name text NOT NULL DEFAULT '',
  prospect_name text NOT NULL DEFAULT '',
  prospect_details jsonb NOT NULL DEFAULT '{}',
  date_met date NOT NULL DEFAULT CURRENT_DATE,
  where_met text NOT NULL DEFAULT '',
  why_good_client text NOT NULL DEFAULT '',
  additional_info text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_prospect_requests_status ON prospect_requests(status);
CREATE INDEX IF NOT EXISTS idx_prospect_requests_submitted_by ON prospect_requests(submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_prospect_requests_created_at ON prospect_requests(created_at);

ALTER TABLE prospect_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own prospect requests"
  ON prospect_requests FOR SELECT
  TO authenticated
  USING (
    submitted_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
    )
  );

-- Authenticated users can insert their own requests
CREATE POLICY "Users can submit prospect requests"
  ON prospect_requests FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by_user_id = auth.uid());

-- Super admins can update any request
CREATE POLICY "Super admins can update prospect requests"
  ON prospect_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
    )
  );

-- Super admins can delete requests
CREATE POLICY "Super admins can delete prospect requests"
  ON prospect_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
    )
  );
