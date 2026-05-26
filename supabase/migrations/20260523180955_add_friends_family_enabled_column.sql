/*
  # Add Friends & Family enabled column

  1. Changes
    - Add `friends_family_enabled` boolean column to `sales_people` table (default: false)
    - Set all existing users to friends_family_enabled = false

  2. Notes
    - This controls per-user visibility of the Friends & Family feature
    - Disabled by default for all new and existing users
    - When disabled, the feature is hidden but data is preserved
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_people' AND column_name = 'friends_family_enabled'
  ) THEN
    ALTER TABLE sales_people ADD COLUMN friends_family_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE sales_people SET friends_family_enabled = false WHERE friends_family_enabled IS NULL OR friends_family_enabled = true;
