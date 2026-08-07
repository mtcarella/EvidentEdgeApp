/*
# Make resources storage bucket public

1. Changes
   - Updates the resources bucket to be publicly accessible
   - This allows direct image URLs in emails without signed URL tokens
   - Outlook is more likely to display images from clean URLs vs signed URLs with long query strings

2. Security
   - Files in the bucket remain protected by existing storage policies for upload/delete
   - Public read access is intentional since resources are meant to be shared with external contacts via email
*/

UPDATE storage.buckets SET public = true WHERE id = 'resources';
