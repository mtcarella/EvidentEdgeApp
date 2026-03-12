/*
  # Fix CLE Fliers Category Spelling

  1. Changes
    - Updates the resource_categories table entry from "CLE Flyers" to "CLE Fliers"
    - This matches the existing resources and the check constraint spelling

  2. Notes
    - The resources table already has entries with "CLE Fliers" spelling
    - The check constraint uses "CLE Fliers" spelling
    - Only the resource_categories table needed updating
*/

UPDATE resource_categories 
SET name = 'CLE Fliers' 
WHERE name = 'CLE Flyers';
