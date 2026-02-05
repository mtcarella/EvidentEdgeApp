/*
  # Rename Paralegal/Processor Field and Add Evident Paralegal Field

  1. Changes
    - Rename column `paralegal_processor` to `client_paralegal_processor` in contacts table
    - Add new column `evident_paralegal` to contacts table
    - Both fields are available for all contact types (buyer, realtor, attorney, loan_officer, vendor)
    
  2. Details
    - `client_paralegal_processor`: Text field for the client's paralegal or processor name
    - `evident_paralegal`: Text field for the Evident Title Agency paralegal assigned
    - Both fields default to empty string and are nullable
    
  3. Security
    - Fields are visible to all users
    - Can be edited by assigned salesperson, admins, super_admins, and processors
*/

-- Rename paralegal_processor to client_paralegal_processor
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'paralegal_processor'
  ) THEN
    ALTER TABLE contacts RENAME COLUMN paralegal_processor TO client_paralegal_processor;
  END IF;
END $$;

-- Add the new evident_paralegal column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'evident_paralegal'
  ) THEN
    ALTER TABLE contacts ADD COLUMN evident_paralegal text DEFAULT '';
  END IF;
END $$;
