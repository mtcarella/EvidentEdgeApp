/*
  # Add Announcement Attachments

  This migration adds document attachment functionality to announcements.

  ## Changes
  1. New Columns on `announcements` table
    - `attachment_name` (text, nullable) - Original filename of the attached document
    - `attachment_path` (text, nullable) - Storage path to the document
    - `attachment_size` (bigint, nullable) - File size in bytes

  ## Storage
  - Creates `announcement-attachments` storage bucket for document uploads
  - RLS policies allow:
    - All authenticated users to read attachments
    - Only admins and super_admins to upload/update/delete attachments
*/

-- Add attachment columns to announcements table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'attachment_name'
  ) THEN
    ALTER TABLE announcements ADD COLUMN attachment_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'attachment_path'
  ) THEN
    ALTER TABLE announcements ADD COLUMN attachment_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'attachment_size'
  ) THEN
    ALTER TABLE announcements ADD COLUMN attachment_size bigint;
  END IF;
END $$;

-- Create storage bucket for announcement attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-attachments', 'announcement-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view announcement attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload announcement attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update announcement attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete announcement attachments" ON storage.objects;

-- Storage policies: Allow all authenticated users to read attachments
CREATE POLICY "Authenticated users can view announcement attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'announcement-attachments');

-- Storage policies: Only admins can upload attachments
CREATE POLICY "Admins can upload announcement attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'announcement-attachments' AND
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- Storage policies: Only admins can update attachments
CREATE POLICY "Admins can update announcement attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'announcement-attachments' AND
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);

-- Storage policies: Only admins can delete attachments
CREATE POLICY "Admins can delete announcement attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'announcement-attachments' AND
  EXISTS (
    SELECT 1 FROM sales_people
    WHERE sales_people.user_id = auth.uid()
    AND sales_people.role IN ('admin', 'super_admin')
  )
);
