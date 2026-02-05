/*
  # Add Paralegal/Processor Field to Contacts

  1. Changes
    - Add new column `paralegal_processor` to contacts table
    - This field can be edited by salespersons, admins, and super admins
    - Default value is empty string
    
  2. Security
    - Field is visible to all users
    - Can be edited by assigned salesperson, admins, super_admins, and processors
*/

-- Add the new paralegal_processor column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'paralegal_processor'
  ) THEN
    ALTER TABLE contacts ADD COLUMN paralegal_processor text DEFAULT '';
  END IF;
END $$;
