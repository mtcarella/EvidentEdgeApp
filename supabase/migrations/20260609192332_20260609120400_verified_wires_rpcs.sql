-- Part 5: RPCs that wrap verified_wires CRUD with vault-backed encrypt/decrypt.
-- Frontend uses these via supabase.rpc(...) instead of direct .from('verified_wires').

-- List all wires with decrypted routing/account numbers.
CREATE OR REPLACE FUNCTION public.list_verified_wires()
RETURNS TABLE (
  id uuid,
  bank_name text,
  account_name text,
  routing_number text,
  account_number text,
  approved_by text,
  date_approved date,
  phone text,
  created_at timestamptz,
  created_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_people sp
    WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin','processor','super_admin','sales_processor')
      AND sp.is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT vw.id,
         vw.bank_name,
         vw.account_name,
         public.decrypt_wire_data(vw.routing_number_encrypted),
         public.decrypt_wire_data(vw.account_number_encrypted),
         vw.approved_by,
         vw.date_approved,
         vw.phone,
         vw.created_at,
         vw.created_by
  FROM public.verified_wires vw
  ORDER BY vw.date_approved DESC NULLS LAST, vw.created_at DESC;
END;
$$;

-- Search a wire by routing/account combination (returns 0 or 1 row).
CREATE OR REPLACE FUNCTION public.search_verified_wire(p_routing text, p_account text)
RETURNS TABLE (
  id uuid,
  bank_name text,
  account_name text,
  routing_number text,
  account_number text,
  approved_by text,
  date_approved date,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_people sp
    WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin','processor','super_admin','sales_processor')
      AND sp.is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT vw.id,
         vw.bank_name,
         vw.account_name,
         public.decrypt_wire_data(vw.routing_number_encrypted),
         public.decrypt_wire_data(vw.account_number_encrypted),
         vw.approved_by,
         vw.date_approved,
         vw.phone
  FROM public.verified_wires vw
  WHERE public.decrypt_wire_data(vw.routing_number_encrypted) = btrim(p_routing)
    AND public.decrypt_wire_data(vw.account_number_encrypted) = btrim(p_account)
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_verified_wire(
  p_bank_name text,
  p_account_name text,
  p_routing text,
  p_account text,
  p_approved_by text,
  p_date_approved date,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_people sp
    WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin','processor','super_admin')
      AND sp.is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.verified_wires (
    bank_name, account_name,
    routing_number_encrypted, account_number_encrypted,
    approved_by, date_approved, phone, created_by
  )
  VALUES (
    p_bank_name, p_account_name,
    public.encrypt_wire_data(btrim(p_routing)),
    public.encrypt_wire_data(btrim(p_account)),
    p_approved_by, p_date_approved, p_phone, auth.uid()
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_verified_wire(
  p_id uuid,
  p_bank_name text,
  p_account_name text,
  p_routing text,
  p_account text,
  p_approved_by text,
  p_date_approved date,
  p_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_people sp
    WHERE sp.user_id = auth.uid()
      AND sp.role = 'super_admin'
      AND sp.is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.verified_wires
  SET bank_name = p_bank_name,
      account_name = p_account_name,
      routing_number_encrypted = public.encrypt_wire_data(btrim(p_routing)),
      account_number_encrypted = public.encrypt_wire_data(btrim(p_account)),
      approved_by = p_approved_by,
      date_approved = p_date_approved,
      phone = p_phone
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_verified_wire(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_people sp
    WHERE sp.user_id = auth.uid()
      AND sp.role = 'super_admin'
      AND sp.is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM public.verified_wires WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_verified_wires() TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_verified_wire(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_verified_wire(text, text, text, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_verified_wire(uuid, text, text, text, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_verified_wire(uuid) TO authenticated;
