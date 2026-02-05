/*
  # Add Marketing and Miscellaneous Categories to Resources

  1. Changes
    - Drop existing category check constraint on resources table
    - Add new constraint that includes all six categories:
      - 'Evident Edge Tutorials'
      - 'Accutitle Tutorials'
      - 'FAQ's'
      - 'Office Resources'
      - 'Marketing'
      - 'Miscellaneous'

  2. Notes
    - This allows admins to categorize resources into Marketing and Miscellaneous folders
    - Existing resources remain unchanged
*/

-- Drop the old constraint
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_category_check;

-- Add new constraint with all six categories
ALTER TABLE resources ADD CONSTRAINT resources_category_check 
  CHECK (category IN (
    'Evident Edge Tutorials', 
    'Accutitle Tutorials', 
    'FAQ''s', 
    'Office Resources',
    'Marketing',
    'Miscellaneous'
  ));
