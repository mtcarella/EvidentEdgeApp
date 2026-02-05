/*
  # Add Additional Contact Fields

  1. Changes
    - Add `preferred_surveyor` (text) - Visible to admin and processor only
    - Add `preferred_uw` (text) - Visible to admin and processor only
    - Add `preferred_closer` (text) - Visible to admin and processor only
    - Add `birthday` (date) - Visible to all users
    - Add `drinks` (boolean) - Visible to all users, default false
  
  2. Notes
    - All fields are nullable to allow gradual data population
    - No RLS changes needed as contact access is already controlled by existing policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'preferred_surveyor'
  ) THEN
    ALTER TABLE contacts ADD COLUMN preferred_surveyor text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'preferred_uw'
  ) THEN
    ALTER TABLE contacts ADD COLUMN preferred_uw text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'preferred_closer'
  ) THEN
    ALTER TABLE contacts ADD COLUMN preferred_closer text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'birthday'
  ) THEN
    ALTER TABLE contacts ADD COLUMN birthday date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'drinks'
  ) THEN
    ALTER TABLE contacts ADD COLUMN drinks boolean DEFAULT false;
  END IF;
END $$;