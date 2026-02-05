/*
  # Clear paralegal field for non-attorney contacts

  1. Changes
    - Sets paralegal field to NULL for all contacts where type is not 'attorney'
    - This ensures the paralegal field is only used for attorney-type contacts
  
  2. Notes
    - This is a data cleanup operation
    - Only attorney contacts should have an assigned paralegal
    - All other contact types will have their paralegal field cleared
*/

UPDATE contacts
SET paralegal = NULL
WHERE type != 'attorney' AND paralegal IS NOT NULL;
