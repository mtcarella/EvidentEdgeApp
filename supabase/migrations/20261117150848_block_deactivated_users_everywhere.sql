/*
# Block all data access for deactivated users

1. Plain-English summary
- A deactivated person (sales_people.is_active = false) can no longer read,
  create, change, or delete any data, even if they still hold a valid
  sign-in token on some device.
- Adds a helper that revokes a user's open sessions so deactivation signs
  them out everywhere.

2. New functions
- `current_user_is_active()` - true unless the signed-in user's profile is
  marked inactive. Users without a profile yet (mid-signup) are treated as
  active so account creation keeps working.
- `revoke_user_sessions(target uuid)` - deletes all open sessions for a user.
  Only callable by the trusted server (service_role).

3. Security changes
- For every RLS-enabled table in `public`, adds RESTRICTIVE policies
  (one each for SELECT, INSERT, UPDATE, DELETE) scoped TO authenticated that
  require `current_user_is_active()`. Restrictive policies are ANDed with the
  existing ones, so nothing that is allowed today becomes more permissive.
- `sales_people` gets INSERT/UPDATE/DELETE restrictions only; SELECT is left
  open so the app can read a user's own inactive status and sign them out
  with a clear message.
- Anonymous (signed-out) access is unaffected.

4. Notes
1. Safe to re-run: policies are dropped before being recreated.
2. No data is changed or removed.
*/

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    (SELECT sp.is_active FROM public.sales_people sp WHERE sp.user_id = auth.uid() LIMIT 1),
    true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revoke_user_sessions(target uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'auth', 'pg_temp'
AS $$
  DELETE FROM auth.sessions WHERE user_id = target;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;

DO $$
DECLARE
  t record;
  cmd text;
  pol text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    FOREACH cmd IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF t.relname = 'sales_people' AND cmd = 'SELECT' THEN
        CONTINUE;
      END IF;
      pol := 'active_users_only_' || lower(cmd);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t.relname);
      IF cmd = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT public.current_user_is_active()))',
          pol, t.relname);
      ELSIF cmd = 'UPDATE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT public.current_user_is_active())) WITH CHECK ((SELECT public.current_user_is_active()))',
          pol, t.relname);
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING ((SELECT public.current_user_is_active()))',
          pol, t.relname, cmd);
      END IF;
    END LOOP;
  END LOOP;
END $$;