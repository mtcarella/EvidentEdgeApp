/*
  # Create Contact Budget Requests System

  1. New Tables
    - `contact_budget_requests`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz, auto-set)
      - `request_date` (date, when the request is for)
      - `requesting_user_id` (uuid, FK to auth.users)
      - `requesting_user_name` (text, display name)
      - `buyer_borrower_name` (text, name of buyer/borrower)
      - `file_number` (text, file reference number)
      - `transaction_type` (text, purchase or refi)
      - `relationship` (text, relationship to buyer/borrower)
      - `status` (text, pending/approved/rejected)
      - `reviewed_by` (uuid, nullable, FK to auth.users)
      - `reviewed_at` (timestamptz, nullable)

  2. Security
    - Enable RLS on `contact_budget_requests`
    - Users can view their own requests
    - Super admins can view all requests
    - Authenticated users can insert their own requests
    - Super admins can update any request
    - Super admins can delete requests

  3. Indexes
    - status (for filtering)
    - requesting_user_id (for user's own requests)
    - created_at (for ordering)
*/

CREATE TABLE IF NOT EXISTS contact_budget_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  requesting_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requesting_user_name text NOT NULL DEFAULT '',
  buyer_borrower_name text NOT NULL DEFAULT '',
  file_number text NOT NULL DEFAULT '',
  transaction_type text NOT NULL DEFAULT 'purchase' CHECK (transaction_type IN ('purchase', 'refi')),
  relationship text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contact_budget_requests_status ON contact_budget_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_budget_requests_user ON contact_budget_requests(requesting_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_budget_requests_created ON contact_budget_requests(created_at);

ALTER TABLE contact_budget_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests, super admins can view all
CREATE POLICY "Users can view own budget requests"
  ON contact_budget_requests FOR SELECT
  TO authenticated
  USING (
    requesting_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
    )
  );

-- Authenticated users can insert their own requests
CREATE POLICY "Users can submit budget requests"
  ON contact_budget_requests FOR INSERT
  TO authenticated
  WITH CHECK (requesting_user_id = auth.uid());

-- Super admins can update any request
CREATE POLICY "Super admins can update budget requests"
  ON contact_budget_requests FOR UPDATE
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
CREATE POLICY "Super admins can delete budget requests"
  ON contact_budget_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
    )
  );
