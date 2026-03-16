/*
  # Remove Hard-coded Category Check Constraint

  1. Changes
    - Removes the resources_category_check constraint that prevents category name changes
    - Category validation is now handled by the resource_categories table relationship
    
  2. Notes
    - The UI already fetches valid categories from resource_categories table
    - This allows admins to rename categories without database constraint violations
*/

ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_category_check;
