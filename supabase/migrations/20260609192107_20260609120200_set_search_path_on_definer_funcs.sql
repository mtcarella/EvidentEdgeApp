-- Part 3: Set search_path on every SECURITY DEFINER function that doesn't have one.
-- Without an explicit search_path, a user with CREATE on a writable schema in
-- the search path can shadow built-ins and escalate.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
      AND p.proname IN (
        'create_adhoc_group_conversation',
        'create_announcement_for_resource',
        'encrypt_wire_data',
        'get_or_create_conversation',
        'get_or_create_group_conversation',
        'set_user_offline',
        'update_conversation_last_message_at',
        'update_user_presence',
        'user_is_conversation_participant'
      )
      AND p.proconfig IS NULL
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      fn.schema, fn.name, fn.args
    );
  END LOOP;
END $$;
