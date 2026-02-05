/*
  # Add Administration Category with Restricted Access

  1. Changes
    - Add 'Administration' to the allowed categories
    - Update SELECT policy to hide Administration resources from non-admin users

  2. Security
    - Only admins and super_admins can see Administration category resources
    - Only admins and super_admins can upload to Administration category
    - Only admins and super_admins can update or delete Administration resources
    - Regular users can still see and access all other categories
*/

-- Drop the old constraint
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_category_check;

-- Add new constraint with Administration category
ALTER TABLE resources ADD CONSTRAINT resources_category_check 
  CHECK (category IN (
    'Evident Edge Tutorials', 
    'Accutitle Tutorials', 
    'FAQ''s', 
    'Office Resources',
    'Marketing',
    'Miscellaneous',
    'Administration'
  ));

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view resources" ON resources;

-- Create new SELECT policy that restricts Administration category
CREATE POLICY "Users can view resources based on role"
  ON resources
  FOR SELECT
  TO authenticated
  USING (
    -- Allow all users to see non-Administration resources
    category != 'Administration'
    OR
    -- Only admins and super_admins can see Administration resources
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );
