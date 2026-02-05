/*
  # Create Resources Table

  1. New Tables
    - `resources`
      - `id` (uuid, primary key) - Unique identifier for each resource
      - `title` (text) - Display name of the resource document
      - `category` (text) - Category: 'Evident Edge Tutorials', 'Accutitle Tutorials', or 'FAQ's'
      - `file_path` (text) - Storage path to the PDF file
      - `file_size` (integer) - File size in bytes
      - `uploaded_by` (uuid) - Reference to sales_people who uploaded
      - `created_at` (timestamptz) - When the resource was uploaded
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `resources` table
    - All authenticated users can view resources
    - Only admins and super_admins can insert resources
    - Only admins and super_admins can delete resources
*/

-- Create resources table
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('Evident Edge Tutorials', 'Accutitle Tutorials', 'FAQ''s')),
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES sales_people(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view resources
CREATE POLICY "Authenticated users can view resources"
  ON resources
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins and super_admins can insert resources
CREATE POLICY "Admins can insert resources"
  ON resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Admins and super_admins can delete resources
CREATE POLICY "Admins can delete resources"
  ON resources
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at DESC);
