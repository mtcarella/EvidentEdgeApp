/*
# Add lunch_required column to sales_people

1. Modified Tables
   - `sales_people`
     - `lunch_required` (boolean, default false) - flags whether this user is required to log lunch daily

2. Notes
   - Admins toggle this per user to track which employees must use the Lunch Clock daily
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_people' AND column_name = 'lunch_required'
  ) THEN
    ALTER TABLE sales_people ADD COLUMN lunch_required boolean NOT NULL DEFAULT false;
  END IF;
END $$;
