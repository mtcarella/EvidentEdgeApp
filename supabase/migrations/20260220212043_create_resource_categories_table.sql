/*
  # Create Resource Categories Table

  1. New Tables
    - `resource_categories`
      - `id` (uuid, primary key)
      - `name` (text, unique) - The category name
      - `icon` (text) - Icon identifier for the category
      - `color` (text) - Color scheme identifier
      - `sort_order` (integer) - Display order
      - `is_active` (boolean) - Whether category is visible
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `resource_categories` table
    - Add policy for authenticated users to read categories
    - Add policy for admins to manage categories

  3. Data Migration
    - Insert existing hardcoded categories as initial data
*/

CREATE TABLE IF NOT EXISTS resource_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  icon text NOT NULL DEFAULT 'FileText',
  color text NOT NULL DEFAULT 'gray',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE resource_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active categories"
  ON resource_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all categories"
  ON resource_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert categories"
  ON resource_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update categories"
  ON resource_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete categories"
  ON resource_categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

INSERT INTO resource_categories (name, icon, color, sort_order) VALUES
  ('Evident Edge Tutorials', 'GraduationCap', 'emerald', 1),
  ('Accutitle Tutorials', 'BookOpen', 'sky', 2),
  ('FAQ''s', 'HelpCircle', 'amber', 3),
  ('Office Resources', 'Briefcase', 'slate', 4),
  ('Marketing', 'Megaphone', 'rose', 5),
  ('Miscellaneous', 'FolderOpen', 'teal', 6)
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_resource_categories_sort_order ON resource_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_resource_categories_is_active ON resource_categories(is_active);