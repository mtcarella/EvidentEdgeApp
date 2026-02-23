/*
  # Replace Miscellaneous Category with CLE Fliers

  1. Changes
    - Updates the check constraint on resources.category to replace 'Miscellaneous' with 'CLE Fliers'
    - Migrates all existing resources from 'Miscellaneous' to 'CLE Fliers'
  
  2. Migration Steps
    - Drop the existing category check constraint
    - Update all resources currently categorized as 'Miscellaneous' to 'CLE Fliers'
    - Create new check constraint with updated category list
*/

-- Drop the existing check constraint
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_category_check;

-- Update existing resources from Miscellaneous to CLE Fliers
UPDATE resources SET category = 'CLE Fliers' WHERE category = 'Miscellaneous';

-- Add new check constraint with CLE Fliers instead of Miscellaneous
ALTER TABLE resources ADD CONSTRAINT resources_category_check 
  CHECK (category = ANY (ARRAY[
    'Evident Edge Tutorials'::text, 
    'Accutitle Tutorials'::text, 
    'FAQ''s'::text, 
    'Office Resources'::text, 
    'Marketing'::text, 
    'CLE Fliers'::text, 
    'Administration'::text
  ]));
