/*
# Block file access for deactivated users

1. Plain-English summary
- Deactivated people can no longer view, upload, change, or delete stored
  files (receipts, resources, documents, attachments).

2. Security changes
- Adds RESTRICTIVE policies on `storage.objects` (SELECT, INSERT, UPDATE,
  DELETE) scoped TO authenticated requiring `public.current_user_is_active()`.
- Public buckets served via public URLs are not affected; signed-out access is
  unchanged.

3. Notes
1. Safe to re-run.
2. No files are changed or removed.
*/

DROP POLICY IF EXISTS "active_users_only_select" ON storage.objects;
CREATE POLICY "active_users_only_select" ON storage.objects AS RESTRICTIVE
FOR SELECT TO authenticated USING ((SELECT public.current_user_is_active()));

DROP POLICY IF EXISTS "active_users_only_insert" ON storage.objects;
CREATE POLICY "active_users_only_insert" ON storage.objects AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK ((SELECT public.current_user_is_active()));

DROP POLICY IF EXISTS "active_users_only_update" ON storage.objects;
CREATE POLICY "active_users_only_update" ON storage.objects AS RESTRICTIVE
FOR UPDATE TO authenticated USING ((SELECT public.current_user_is_active())) WITH CHECK ((SELECT public.current_user_is_active()));

DROP POLICY IF EXISTS "active_users_only_delete" ON storage.objects;
CREATE POLICY "active_users_only_delete" ON storage.objects AS RESTRICTIVE
FOR DELETE TO authenticated USING ((SELECT public.current_user_is_active()));