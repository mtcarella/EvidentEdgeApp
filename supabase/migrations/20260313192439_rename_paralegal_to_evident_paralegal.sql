/*
  # Rename paralegal column to evident_paralegal

  1. Changes
    - Rename the `paralegal` column to `evident_paralegal` in the contacts table
    - This consolidates the naming to be consistent with the UI label

  2. Notes
    - Data is preserved during rename
    - The old `evident_paralegal` column (if it exists and is empty) will be dropped
*/

-- First, drop the empty evident_paralegal column if it exists
ALTER TABLE contacts DROP COLUMN IF EXISTS evident_paralegal;

-- Rename paralegal to evident_paralegal
ALTER TABLE contacts RENAME COLUMN paralegal TO evident_paralegal;