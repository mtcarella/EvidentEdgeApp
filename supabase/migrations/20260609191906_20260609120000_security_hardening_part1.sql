-- Part 1: Impersonation audit + lock privileged sales_people columns

CREATE TABLE IF NOT EXISTS impersonation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  target_user_id uuid,
  target_email text,
  success boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_audit_actor_created
  ON impersonation_audit (actor_user_id, created_at DESC);

ALTER TABLE impersonation_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_select_impersonation_audit" ON impersonation_audit;
CREATE POLICY "super_admins_select_impersonation_audit" ON impersonation_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
        AND (sp.role = 'super_admin' OR sp.is_super_admin = true)
    )
  );

-- Block privileged column self-edits via trigger.
-- Users may continue to update non-privileged columns on their own row,
-- but role / is_active / is_super_admin can only be changed by super_admins
-- or the service role.
CREATE OR REPLACE FUNCTION public.guard_sales_people_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_is_super boolean := false;
  caller_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Service role bypass (edge functions / admin API)
  IF caller_role = 'service_role' THEN
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
$$;

DROP TRIGGER IF EXISTS trg_guard_sales_people_privileged_columns ON sales_people;
CREATE TRIGGER trg_guard_sales_people_privileged_columns
  BEFORE UPDATE ON sales_people
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sales_people_privileged_columns();
