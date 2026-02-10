/*
  # Make Announcement Attachments Bucket Public

  This migration updates the announcement-attachments storage bucket to be public,
  allowing attachments to be viewed directly in the browser via public URLs.

  ## Changes
  - Updates `announcement-attachments` bucket to be public
  - This allows users to view attachments (PDFs, images, documents) in browser
  - RLS policies still control who can upload/update/delete attachments
*/

-- Update the bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'announcement-attachments';
