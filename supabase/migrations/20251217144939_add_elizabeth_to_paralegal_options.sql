/*
  # Add Elizabeth to Paralegal Options

  1. Changes
    - Drop existing paralegal check constraint
    - Add new constraint that includes 'Elizabeth' as an option
    
  2. Details
    - Paralegal field options: Kristen, Lisa, Raphael, Danielle, Elizabeth
    - This field is only used for attorney contacts
*/

-- Drop the old constraint if it exists
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_paralegal_check;

-- Add new constraint with Elizabeth included
ALTER TABLE contacts ADD CONSTRAINT contacts_paralegal_check 
  CHECK (paralegal = ANY (ARRAY['Kristen'::text, 'Lisa'::text, 'Raphael'::text, 'Danielle'::text, 'Elizabeth'::text]) OR paralegal IS NULL);
