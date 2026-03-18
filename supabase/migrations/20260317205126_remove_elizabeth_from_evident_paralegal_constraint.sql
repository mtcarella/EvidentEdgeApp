/*
  # Remove Elizabeth from Evident Paralegal Options

  1. Changes
    - Update check constraint to remove Elizabeth from allowed values
    - Clear any existing contacts that have Elizabeth as their evident_paralegal

  2. Purpose
    - Elizabeth Castro has been removed as a user
*/

UPDATE contacts SET evident_paralegal = NULL WHERE evident_paralegal = 'Elizabeth';

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_evident_paralegal_check;

ALTER TABLE contacts ADD CONSTRAINT contacts_evident_paralegal_check
  CHECK (
    evident_paralegal IS NULL OR 
    evident_paralegal = ANY (ARRAY['Danielle', 'Jahaira', 'Kristen', 'Lisa', 'Raphael'])
  );