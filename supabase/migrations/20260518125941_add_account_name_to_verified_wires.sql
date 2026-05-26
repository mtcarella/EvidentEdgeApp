/*
  # Add account name column to verified wires

  1. Schema Changes
    - Add `account_name` text column (nullable, defaults to empty string)
      to `verified_wires` table. Stores the name on the account for
      quick identification in the Manage view.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'verified_wires' AND column_name = 'account_name'
  ) THEN
    ALTER TABLE verified_wires ADD COLUMN account_name text NOT NULL DEFAULT '';
  END IF;
END $$;
