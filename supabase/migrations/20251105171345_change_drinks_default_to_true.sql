/*
  # Change drinks field default to true

  1. Changes
    - Alter the `drinks` column in `contacts` table to have a default value of `true`
  
  2. Notes
    - This ensures all new prospects will have drinks set to `true` by default
    - Existing contacts have already been updated to `true` via a separate data update
*/

ALTER TABLE contacts 
ALTER COLUMN drinks SET DEFAULT true;
