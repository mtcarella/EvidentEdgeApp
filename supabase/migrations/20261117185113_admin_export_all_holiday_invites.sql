/*
# Admin export of all holiday card / party invites

1. Plain-English summary
   Admins can now download every user's holiday card / party invite list in a single
   spreadsheet. Each row is one invited contact, labeled with the name of the user
   who chose to invite them.

2. New Functions
   - `admin_export_holiday_invites()` returns one row per invite with the inviting
     user's name and email, the contact's details, and the date the invite was added.

3. Security
   - The function is SECURITY DEFINER so it can read invites belonging to every user,
     but it first verifies that the caller is an active admin or super_admin and raises
     an error otherwise.
   - EXECUTE is revoked from PUBLIC and anon and granted only to authenticated.
   - Existing per-user policies on `holiday_invites` are unchanged, so regular users still
     see only their own invites.

4. Important notes
   1. Read-only: nothing is modified.
   2. Users with no login record still appear under the name "Unknown User".
*/

CREATE OR REPLACE FUNCTION public.admin_export_holiday_invites()
RETURNS TABLE (
  invited_by_name text,
  invited_by_email text,
  invite_added_at timestamptz,
  contact jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_people sp
    WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin', 'super_admin')
      AND sp.is_active = true
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(owner.name, 'Unknown User')::text,
    owner.email::text,
    hi.created_at,
    to_jsonb(c.*)
  FROM public.holiday_invites hi
  JOIN public.contacts c ON c.id = hi.contact_id
  LEFT JOIN LATERAL (
    SELECT sp.name, sp.email FROM public.sales_people sp
    WHERE sp.user_id = hi.user_id
    LIMIT 1
  ) owner ON true
  ORDER BY COALESCE(owner.name, 'Unknown User'), c.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_export_holiday_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_export_holiday_invites() TO authenticated;
