/*
  # Fix cascade delete for contacts table

  1. Changes
    - Drop and recreate foreign key constraints on contacts table
    - Add ON DELETE SET NULL to created_by and updated_by columns
    - This allows user deletion without breaking contact records
  
  2. Security
    - No changes to RLS policies
*/

-- Drop existing foreign key constraints
ALTER TABLE contacts 
  DROP CONSTRAINT IF EXISTS contacts_created_by_fkey;

ALTER TABLE contacts 
  DROP CONSTRAINT IF EXISTS contacts_updated_by_fkey;

ALTER TABLE assignments 
  DROP CONSTRAINT IF EXISTS assignments_assigned_by_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE contacts
  ADD CONSTRAINT contacts_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

ALTER TABLE contacts
  ADD CONSTRAINT contacts_updated_by_fkey 
  FOREIGN KEY (updated_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_assigned_by_fkey 
  FOREIGN KEY (assigned_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;
