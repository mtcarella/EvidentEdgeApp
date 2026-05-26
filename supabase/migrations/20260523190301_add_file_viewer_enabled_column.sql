/*
  # Add file_viewer_enabled Column to Sales People

  1. Modified Tables
    - `sales_people`
      - Added `file_viewer_enabled` (boolean, NOT NULL, DEFAULT false)

  2. Notes
    - Controls access to the File Viewer module
    - Disabled by default for all users
    - Must be explicitly enabled per user by an admin
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_people' AND column_name = 'file_viewer_enabled'
  ) THEN
    ALTER TABLE sales_people ADD COLUMN file_viewer_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;
