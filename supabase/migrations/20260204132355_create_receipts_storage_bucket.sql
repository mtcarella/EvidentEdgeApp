/*
  # Create receipts storage bucket

  1. New Storage Bucket
    - `receipts` - stores receipt images for meeting expenses
  
  2. Security Policies
    - Authenticated users can upload receipts
    - Authenticated users can view receipts
    - Users can delete their own receipts
    - Admins and super admins can view and delete all receipts
*/

-- Create the receipts bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete all receipts" ON storage.objects;

-- Policy: Authenticated users can upload receipts
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
);

-- Policy: Authenticated users can view receipts
CREATE POLICY "Authenticated users can view receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Policy: Users can delete their own receipts
CREATE POLICY "Users can delete their own receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  owner = auth.uid()
);

-- Policy: Admins can view all receipts
CREATE POLICY "Admins can view all receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Policy: Admins can delete all receipts
CREATE POLICY "Admins can delete all receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);