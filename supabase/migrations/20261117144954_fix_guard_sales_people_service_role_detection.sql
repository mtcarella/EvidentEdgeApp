/*
# Fix trusted-server detection in sales_people column guard

1. Problem
- The guard trigger that stops non-super-admins from changing role / is_active /
  is_super_admin only recognized the trusted server via the legacy
  `request.jwt.claim.role` setting. Newer API versions only set
  `request.jwt.claims` (JSON), so server-side updates (e.g. the
  set-user-active function) were wrongly rejected.

2. Changes
- `guard_sales_people_privileged_columns()` now treats the caller as trusted
  when the role is `service_role` from either setting, or when the session
  role itself is service_role / postgres.

3. Security
- No change to who may modify privileged columns from the browser: only
  super admins. No tables, policies, or grants changed.
*/

CREATE OR REPLACE FUNCTION public.guard_sales_people_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  caller_is_super boolean := false;
  legacy_role text := current_setting('request.jwt.claim.role', true);
  claims_role text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
BEGIN
  IF legacy_role = 'service_role'
     OR claims_role = 'service_role'
     OR session_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  SELECT (sp.role = 'super_admin' OR sp.is_super_admin = true)
  INTO caller_is_super
  FROM public.sales_people sp
  WHERE sp.user_id = auth.uid()
  LIMIT 1;

  IF NOT COALESCE(caller_is_super, false) THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Permission denied: cannot modify role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Permission denied: cannot modify is_active';
    END IF;
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
      RAISE EXCEPTION 'Permission denied: cannot modify is_super_admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;