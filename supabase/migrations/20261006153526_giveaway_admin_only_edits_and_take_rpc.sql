/*
# Giveaway inventory: admin-only editing and safe "take" action

1. Plain-English summary
   - Only admins and super admins can add, edit, or remove giveaway items.
   - Regular users take items through a single secure action that checks the
     amount, subtracts it from stock, and logs who took it, all at once.

2. Modified Tables
   - `giveaway_items`: INSERT / UPDATE / DELETE policies now require the caller
     to be an active admin or super_admin. SELECT unchanged (all signed-in users).
     Adds a NOT VALID check that quantity can never go below zero.
   - `giveaway_transactions`: direct INSERT / UPDATE / DELETE limited to admins.
     Normal take logging happens inside the new function. SELECT unchanged.

3. New Functions
   - `is_giveaway_admin()` - true when the caller is an active admin/super_admin.
   - `take_giveaway_item(p_item_id, p_quantity, p_user_name)` - validates the
     quantity (>= 1), atomically decrements stock only if enough is available,
     logs the transaction, and returns the new quantity. Executable by
     signed-in users only.

4. Notes
   1. The decrement uses a conditional UPDATE so two people taking at the same
      time can never push stock negative.
*/

CREATE OR REPLACE FUNCTION public.is_giveaway_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sales_people
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_giveaway_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_giveaway_admin() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'giveaway_items_quantity_nonnegative'
  ) THEN
    ALTER TABLE giveaway_items
      ADD CONSTRAINT giveaway_items_quantity_nonnegative CHECK (current_quantity >= 0) NOT VALID;
  END IF;
END $$;

DROP POLICY IF EXISTS "insert_giveaway_items" ON giveaway_items;
CREATE POLICY "insert_giveaway_items" ON giveaway_items FOR INSERT
  TO authenticated WITH CHECK (public.is_giveaway_admin());

DROP POLICY IF EXISTS "update_giveaway_items" ON giveaway_items;
CREATE POLICY "update_giveaway_items" ON giveaway_items FOR UPDATE
  TO authenticated USING (public.is_giveaway_admin()) WITH CHECK (public.is_giveaway_admin());

DROP POLICY IF EXISTS "delete_giveaway_items" ON giveaway_items;
CREATE POLICY "delete_giveaway_items" ON giveaway_items FOR DELETE
  TO authenticated USING (public.is_giveaway_admin());

DROP POLICY IF EXISTS "insert_giveaway_transactions" ON giveaway_transactions;
CREATE POLICY "insert_giveaway_transactions" ON giveaway_transactions FOR INSERT
  TO authenticated WITH CHECK (public.is_giveaway_admin());

DROP POLICY IF EXISTS "update_giveaway_transactions" ON giveaway_transactions;
CREATE POLICY "update_giveaway_transactions" ON giveaway_transactions FOR UPDATE
  TO authenticated USING (public.is_giveaway_admin()) WITH CHECK (public.is_giveaway_admin());

DROP POLICY IF EXISTS "delete_giveaway_transactions" ON giveaway_transactions;
CREATE POLICY "delete_giveaway_transactions" ON giveaway_transactions FOR DELETE
  TO authenticated USING (public.is_giveaway_admin());

CREATE OR REPLACE FUNCTION public.take_giveaway_item(
  p_item_id uuid,
  p_quantity integer,
  p_user_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_item_name text;
  v_new_qty integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  v_name := btrim(coalesce(p_user_name, ''));
  IF v_name = '' OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'A valid name is required';
  END IF;

  UPDATE giveaway_items
     SET current_quantity = current_quantity - p_quantity
   WHERE id = p_item_id
     AND current_quantity >= p_quantity
  RETURNING current_quantity, item_name INTO v_new_qty, v_item_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough stock available';
  END IF;

  INSERT INTO giveaway_transactions (item_id, item_name, quantity_taken, user_name)
  VALUES (p_item_id, v_item_name, p_quantity, v_name);

  RETURN v_new_qty;
END;
$$;

REVOKE ALL ON FUNCTION public.take_giveaway_item(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_giveaway_item(uuid, integer, text) TO authenticated;
