/*
  # Update Evident Paralegal Check Constraint

  1. Changes
    - Drop old constraint that's missing "Jahaira" option
    - Create new constraint with all valid paralegal names: Danielle, Elizabeth, Jahaira, Kristen, Lisa, Raphael

  2. Purpose
    - Allow "Jahaira" to be selected as an Evident Paralegal option
*/

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_paralegal_check;

ALTER TABLE contacts ADD CONSTRAINT contacts_evident_paralegal_check
  CHECK (
    evident_paralegal IS NULL OR 
    evident_paralegal = ANY (ARRAY['Danielle', 'Elizabeth', 'Jahaira', 'Kristen', 'Lisa', 'Raphael'])
  );