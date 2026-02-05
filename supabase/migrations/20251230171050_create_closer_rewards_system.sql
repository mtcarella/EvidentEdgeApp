/*
  # Create Closer Rewards System

  1. New Tables
    - `closer_submissions`
      - `id` (uuid, primary key) - Unique identifier for each submission
      - `file_number` (text, required) - File/loan number associated with closing
      - `closer_id` (uuid, foreign key) - References the closer in sales_people table
      - `closer_name` (text) - Name of the closer (denormalized for reporting)
      - `submission_date` (date) - Date of the closing/submission
      - `submission_type` (text) - Type: 'closing_photo', 'google_review', or 'photobooth'
      - `image_url` (text) - Path to the uploaded image in storage
      - `created_at` (timestamptz) - When the submission was created

  2. Storage
    - Create `closer_rewards` bucket for storing submission images
    - Set up policies for closers to upload and admins to view

  3. Security
    - Enable RLS on `closer_submissions` table
    - Closers can insert their own submissions and view their own
    - Admins and super_admins can view all submissions
    - Super_admins can delete submissions if needed

  4. Indexes
    - Index on file_number for grouping submissions by file
    - Index on closer_id for filtering by closer
    - Index on submission_date for monthly reporting
*/

-- Create the closer_submissions table
CREATE TABLE IF NOT EXISTS closer_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_number text NOT NULL,
  closer_id uuid NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  closer_name text NOT NULL,
  submission_date date NOT NULL DEFAULT CURRENT_DATE,
  submission_type text NOT NULL CHECK (submission_type IN ('closing_photo', 'google_review', 'photobooth')),
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_closer_submissions_file_number ON closer_submissions(file_number);
CREATE INDEX IF NOT EXISTS idx_closer_submissions_closer_id ON closer_submissions(closer_id);
CREATE INDEX IF NOT EXISTS idx_closer_submissions_date ON closer_submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_closer_submissions_type ON closer_submissions(submission_type);

-- Enable RLS
ALTER TABLE closer_submissions ENABLE ROW LEVEL SECURITY;

-- Closers can insert their own submissions
CREATE POLICY "Closers can insert own submissions"
  ON closer_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    closer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'closer'
      AND sales_people.is_active = true
    )
  );

-- Closers can view their own submissions
CREATE POLICY "Closers can view own submissions"
  ON closer_submissions FOR SELECT
  TO authenticated
  USING (
    closer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Admins and super_admins can view all submissions
CREATE POLICY "Admins can view all submissions"
  ON closer_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );

-- Super admins can delete submissions if needed
CREATE POLICY "Super admins can delete submissions"
  ON closer_submissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );

-- Create storage bucket for closer rewards images
INSERT INTO storage.buckets (id, name, public)
VALUES ('closer-rewards', 'closer-rewards', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for closer-rewards bucket
-- Closers can upload images
CREATE POLICY "Closers can upload reward images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'closer-rewards' AND
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'closer'
      AND sales_people.is_active = true
    )
  );

-- Authenticated users can view images (closers their own, admins all)
CREATE POLICY "Authenticated users can view reward images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'closer-rewards' AND
    (
      -- Closers can view their own uploads
      (storage.foldername(name))[1] = auth.uid()::text OR
      -- Admins can view all
      EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.id = auth.uid()
        AND sales_people.role IN ('admin', 'super_admin')
        AND sales_people.is_active = true
      )
    )
  );

-- Super admins can delete images if needed
CREATE POLICY "Super admins can delete reward images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'closer-rewards' AND
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );