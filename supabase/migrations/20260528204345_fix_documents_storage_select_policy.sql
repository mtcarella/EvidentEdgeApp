/*
  # Fix documents storage SELECT policy

  1. Problem
    - Existing SELECT policy only allows access to files in the 'private' folder
    - Actual document files are stored at the bucket root level
    - This prevents authenticated users from generating signed URLs or downloading files

  2. Changes
    - Add a new SELECT policy that allows authenticated users to read any file in the documents bucket

  3. Security
    - Access restricted to authenticated users only
*/

CREATE POLICY "Authenticated users can read documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');
