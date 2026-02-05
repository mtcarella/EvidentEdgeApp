/*
  # Fix Closer Rewards Storage Policy for Super Admins

  1. Changes
    - Update storage upload policy to allow super_admins to upload images
    - This enables super admins to test the rewards submission system fully
  
  2. Security
    - Closers can upload to their own folder
    - Super admins can upload to any folder for testing purposes
*/

-- Drop the existing upload policy
DROP POLICY IF EXISTS "Closers can upload reward images" ON storage.objects;

-- Create new upload policy that allows both closers and super_admins
CREATE POLICY "Closers and super admins can upload reward images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'closer-rewards' AND
    (
      -- Closers can upload to their own folder
      (
        EXISTS (
          SELECT 1 FROM sales_people
          WHERE sales_people.id = auth.uid()
          AND sales_people.role = 'closer'
          AND sales_people.is_active = true
        ) AND
        (storage.foldername(name))[1] = auth.uid()::text
      )
      OR
      -- Super admins can upload to any folder for testing
      EXISTS (
        SELECT 1 FROM sales_people
        WHERE sales_people.id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
      )
    )
  );
