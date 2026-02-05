/*
  # Add vendor type to contacts

  1. Changes
    - Drop existing type check constraint
    - Add new type check constraint that includes 'vendor'

  2. Notes
    - This allows contacts to have type 'vendor' in addition to buyer, realtor, attorney, and lender
*/

-- Drop the old constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_type_check;

-- Add new constraint with vendor included
ALTER TABLE contacts ADD CONSTRAINT contacts_type_check 
  CHECK (type = ANY (ARRAY['buyer'::text, 'realtor'::text, 'attorney'::text, 'lender'::text, 'vendor'::text]));