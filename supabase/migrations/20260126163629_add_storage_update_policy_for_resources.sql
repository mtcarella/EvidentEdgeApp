/*
  # Add Storage UPDATE Policy for Resources

  1. Changes
    - Add UPDATE policy for storage.objects to allow admins to update file metadata
    - This is needed when moving files between folders/categories

  2. Security
    - Only admins and super_admins can update storage objects
    - Applies only to resources bucket
*/

-- Add UPDATE policy for storage objects
CREATE POLICY "Admins can update resource files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resources' AND
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
)
WITH CHECK (
  bucket_id = 'resources' AND
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);
