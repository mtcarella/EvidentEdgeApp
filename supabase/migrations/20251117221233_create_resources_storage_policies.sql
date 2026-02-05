/*
  # Create Storage Policies for Resources Bucket

  1. Storage Policies
    - All authenticated users can view/download resource files
    - Only admins and super_admins can upload files
    - Only admins and super_admins can delete files

  2. Security
    - Policies are restrictive and check user roles
    - Files are not publicly accessible
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view resource files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload resource files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete resource files" ON storage.objects;

-- Allow authenticated users to read files from resources bucket
CREATE POLICY "Authenticated users can view resource files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resources');

-- Allow admins to upload files to resources bucket
CREATE POLICY "Admins can upload resource files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resources' AND
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);

-- Allow admins to delete files from resources bucket
CREATE POLICY "Admins can delete resource files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resources' AND
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = true
  )
);
