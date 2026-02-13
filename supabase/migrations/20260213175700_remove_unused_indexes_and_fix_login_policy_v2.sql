/*
  # Remove Unused Indexes and Fix Login Policy

  ## Changes

  ### 1. Remove Metadata Indexes (Not Used in Queries)
  These indexes on metadata fields (created_by, uploaded_by, etc.) are rarely queried:
    - idx_announcements_created_by
    - idx_communication_logs_sent_by
    - idx_contacts_created_by
    - idx_resources_uploaded_by
    - idx_shared_contact_access_created_by
    - idx_user_groups_created_by
    - idx_user_module_permissions_granted_by
    - idx_verified_wires_created_by
    - idx_wire_verification_logs_created_by

  ### 2. Keep Essential Indexes (Used in Common Queries)
  These indexes support frequently used queries and joins:
    - idx_communication_logs_group_id (JOIN operations)
    - idx_weekly_performance_reports_processor_id (filtering reports)
    - idx_wire_verification_logs_verified_wire_id (JOIN operations)
    - idx_shared_contact_access_salesperson_id (filtering access)
    - idx_user_group_members_user_id (filtering memberships)

  ### 3. Fix Login Attempts Policy
    - Add IP-based rate limiting through CHECK constraint
    - Restrict excessive attempts from same IP
*/

-- =============================================
-- 1. DROP UNUSED METADATA INDEXES
-- =============================================

DROP INDEX IF EXISTS idx_announcements_created_by;
DROP INDEX IF EXISTS idx_communication_logs_sent_by;
DROP INDEX IF EXISTS idx_contacts_created_by;
DROP INDEX IF EXISTS idx_resources_uploaded_by;
DROP INDEX IF EXISTS idx_shared_contact_access_created_by;
DROP INDEX IF EXISTS idx_user_groups_created_by;
DROP INDEX IF EXISTS idx_user_module_permissions_granted_by;
DROP INDEX IF EXISTS idx_verified_wires_created_by;
DROP INDEX IF EXISTS idx_wire_verification_logs_created_by;

-- =============================================
-- 2. FIX LOGIN ATTEMPTS POLICY
-- =============================================

-- Drop the permissive policy
DROP POLICY IF EXISTS "Allow insert login attempts with rate limiting" ON public.login_attempts;
DROP POLICY IF EXISTS "Anyone can insert login attempts" ON public.login_attempts;

-- Create a more controlled policy
-- Note: This still needs to be permissive for the feature to work,
-- but we add application-level rate limiting through triggers
CREATE POLICY "Insert login attempts for tracking"
  ON public.login_attempts FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Verify email is provided and not empty
    email IS NOT NULL AND LENGTH(email) > 0
    AND ip_address IS NOT NULL AND LENGTH(ip_address) > 0
    -- Note: Rate limiting is enforced through the trigger function
  );

-- =============================================
-- 3. ADD TRIGGER FOR RATE LIMITING
-- =============================================

-- Create a trigger function to prevent abuse
CREATE OR REPLACE FUNCTION public.prevent_excessive_login_attempts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recent_attempts INTEGER;
BEGIN
  -- Count recent attempts from this IP in the last 15 minutes
  SELECT COUNT(*)
  INTO recent_attempts
  FROM public.login_attempts
  WHERE ip_address = NEW.ip_address
    AND attempt_time > NOW() - INTERVAL '15 minutes';

  -- If more than 50 attempts in 15 minutes, reject
  IF recent_attempts >= 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded for IP address. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$;

-- Add the trigger
DROP TRIGGER IF EXISTS trigger_prevent_excessive_login_attempts ON public.login_attempts;
CREATE TRIGGER trigger_prevent_excessive_login_attempts
  BEFORE INSERT ON public.login_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_excessive_login_attempts();

-- =============================================
-- 4. ADD INDEX FOR RATE LIMITING QUERY
-- =============================================

-- This index is needed for the rate limiting query to be fast
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time 
  ON public.login_attempts(ip_address, attempt_time DESC);

-- Add cleanup policy
COMMENT ON TRIGGER trigger_prevent_excessive_login_attempts ON public.login_attempts IS
  'Prevents more than 50 login attempts from the same IP within 15 minutes to mitigate brute force attacks.';