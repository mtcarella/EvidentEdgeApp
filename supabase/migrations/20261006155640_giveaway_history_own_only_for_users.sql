/*
# Giveaway history: users see only their own, admins see all

1. Plain-English summary
   - Each giveaway history entry now records which signed-in account took the item.
   - Regular users can only see their own history entries.
   - Admins and super admins still see the full history.

2. Modified Tables
   - `giveaway_transactions`
     - New column `taken_by` (uuid, nullable, defaults to the signed-in user).
       Nullable because older entries were saved before accounts were tracked.
     - SELECT policy replaced: visible when the caller is an admin/super_admin
       OR the entry belongs to the caller.

3. Modified Functions
   - `take_giveaway_item` now stores the caller's account on the entry.

4. Data backfill
   1. Older entries are linked to an account only when the typed name exactly
      matches (case-insensitive) exactly one person in `sales_people`.
      Entries that can't be matched stay admin-only.
*/

ALTER TABLE giveaway_transactions
  ADD COLUMN IF NOT EXISTS taken_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS giveaway_transactions_taken_by_idx ON giveaway_transactions (taken_by);

UPDATE giveaway_transactions t
   SET taken_by = m.user_id
  FROM (
    SELECT lower(btrim(name)) AS lname, min(user_id::text)::uuid AS user_id
      FROM sales_people
     WHERE user_id IS NOT NULL AND name IS NOT NULL
     GROUP BY lower(btrim(name))
    HAVING count(*) = 1
  ) m
 WHERE t.taken_by IS NULL
   AND lower(btrim(t.user_name)) = m.lname;

DROP POLICY IF EXISTS "select_giveaway_transactions" ON giveaway_transactions;
CREATE POLICY "select_giveaway_transactions" ON giveaway_transactions FOR SELECT
  TO authenticated
  USING (public.is_giveaway_admin() OR taken_by = auth.uid());

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

  INSERT INTO giveaway_transactions (item_id, item_name, quantity_taken, user_name, taken_by)
  VALUES (p_item_id, v_item_name, p_quantity, v_name, auth.uid());

  RETURN v_new_qty;
END;
$$;

REVOKE ALL ON FUNCTION public.take_giveaway_item(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_giveaway_item(uuid, integer, text) TO authenticated;
