/*
# Create Giveaway Item Inventory System

1. New Tables
   - `giveaway_items`
     - `id` (uuid, primary key)
     - `item_name` (text, not null) - name of the giveaway item
     - `category` (text, optional) - category grouping
     - `current_quantity` (integer, not null, default 0) - current stock level
     - `unit` (text, default 'pieces') - unit of measurement
     - `notes` (text, optional) - additional notes
     - `created_at` (timestamptz) - creation timestamp
   - `giveaway_transactions`
     - `id` (uuid, primary key)
     - `item_id` (uuid, references giveaway_items) - which item was taken
     - `item_name` (text) - denormalized item name for easy display
     - `quantity_taken` (integer, not null) - how many were taken
     - `user_name` (text, not null) - who took the items
     - `taken_at` (timestamptz) - when items were taken

2. Security
   - Enable RLS on both tables.
   - Allow authenticated users full CRUD access (app has sign-in).

3. Seed Data
   - Insert placeholder items: T-Shirt, Tote Bag, Pen, Sticker Pack, Water Bottle, Lanyard

4. Notes
   - Transactions are logged for audit purposes.
   - Quantity adjustments happen at the application level (subtract from current_quantity).
*/

-- Create giveaway_items table
CREATE TABLE IF NOT EXISTS giveaway_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  category text,
  current_quantity integer NOT NULL DEFAULT 0,
  unit text DEFAULT 'pieces',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE giveaway_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_giveaway_items" ON giveaway_items;
CREATE POLICY "select_giveaway_items" ON giveaway_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_giveaway_items" ON giveaway_items;
CREATE POLICY "insert_giveaway_items" ON giveaway_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_giveaway_items" ON giveaway_items;
CREATE POLICY "update_giveaway_items" ON giveaway_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_giveaway_items" ON giveaway_items;
CREATE POLICY "delete_giveaway_items" ON giveaway_items FOR DELETE
  TO authenticated USING (true);

-- Create giveaway_transactions table
CREATE TABLE IF NOT EXISTS giveaway_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES giveaway_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity_taken integer NOT NULL,
  user_name text NOT NULL,
  taken_at timestamptz DEFAULT now()
);

ALTER TABLE giveaway_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_giveaway_transactions" ON giveaway_transactions;
CREATE POLICY "select_giveaway_transactions" ON giveaway_transactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_giveaway_transactions" ON giveaway_transactions;
CREATE POLICY "insert_giveaway_transactions" ON giveaway_transactions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_giveaway_transactions" ON giveaway_transactions;
CREATE POLICY "update_giveaway_transactions" ON giveaway_transactions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_giveaway_transactions" ON giveaway_transactions;
CREATE POLICY "delete_giveaway_transactions" ON giveaway_transactions FOR DELETE
  TO authenticated USING (true);

-- Seed placeholder items
INSERT INTO giveaway_items (item_name, category, current_quantity, unit, notes) VALUES
  ('T-Shirt', 'Apparel', 50, 'pieces', 'Assorted sizes S-XL'),
  ('Tote Bag', 'Apparel', 30, 'pieces', 'Canvas with company logo'),
  ('Pen', 'Office', 200, 'pieces', 'Blue ink, branded'),
  ('Sticker Pack', 'Promotional', 150, 'packs', '5 stickers per pack'),
  ('Water Bottle', 'Drinkware', 25, 'pieces', 'Stainless steel, 20oz'),
  ('Lanyard', 'Accessories', 75, 'pieces', 'With badge holder')
ON CONFLICT DO NOTHING;