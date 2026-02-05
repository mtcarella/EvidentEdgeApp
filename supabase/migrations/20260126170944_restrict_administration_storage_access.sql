/*
  # Restrict Administration Folder Storage Access

  1. Changes
    - Update SELECT policy on storage.objects to restrict Administration folder
    - Only admins and super_admins can view files in Administration folder
    - All users can view files in other folders

  2. Security
    - Files in Administration folder are only visible to admins and super_admins
    - Regular users cannot see or download Administration files
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view resource files" ON storage.objects;

-- Create new SELECT policy with folder-based restrictions
CREATE POLICY "Users can view resources based on folder and role"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resources' AND (
    -- Allow all users to see non-Administration files
    NOT (name LIKE 'Administration/%')
    OR
    -- Only admins and super_admins can see Administration files
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  )
);
