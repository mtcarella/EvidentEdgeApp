/*
  # Sync sales_people IDs with auth.users IDs

  1. Problem
    - The sales_people.id values don't match auth.users.id values
    - This breaks RLS policies that check auth.uid() = sales_people.id
    - Users cannot insert records because the policy comparison fails

  2. Solution
    - Temporarily drop foreign key constraints
    - Update all IDs across related tables
    - Update sales_people.id to match auth.users.id
    - Recreate foreign key constraints with ON UPDATE CASCADE

  3. Security
    - After this migration, all RLS policies will function as intended
    - Users will only be able to access their own data or data they're authorized for
*/

-- Step 1: Drop all foreign key constraints referencing sales_people.id
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_salesperson_id_fkey;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_assigned_to_fkey;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_salesperson_id_fkey;
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_uploaded_by_fkey;
ALTER TABLE shared_contact_access DROP CONSTRAINT IF EXISTS shared_contact_access_viewer_id_fkey;
ALTER TABLE shared_contact_access DROP CONSTRAINT IF EXISTS shared_contact_access_salesperson_id_fkey;
ALTER TABLE closer_submissions DROP CONSTRAINT IF EXISTS closer_submissions_closer_id_fkey;

-- Step 2: Update all foreign key references in related tables
-- Create a temporary mapping table
CREATE TEMP TABLE id_mapping AS
SELECT sp.id as old_id, au.id as new_id
FROM sales_people sp
JOIN auth.users au ON sp.email = au.email
WHERE sp.id != au.id;

-- Update contacts.assigned_to
UPDATE contacts c
SET assigned_to = im.new_id
FROM id_mapping im
WHERE c.assigned_to = im.old_id;

-- Update assignments.salesperson_id
UPDATE assignments a
SET salesperson_id = im.new_id
FROM id_mapping im
WHERE a.salesperson_id = im.old_id;

-- Update meetings.salesperson_id
UPDATE meetings m
SET salesperson_id = im.new_id
FROM id_mapping im
WHERE m.salesperson_id = im.old_id;

-- Update resources.uploaded_by
UPDATE resources r
SET uploaded_by = im.new_id
FROM id_mapping im
WHERE r.uploaded_by = im.old_id;

-- Update shared_contact_access.viewer_id
UPDATE shared_contact_access sca
SET viewer_id = im.new_id
FROM id_mapping im
WHERE sca.viewer_id = im.old_id;

-- Update shared_contact_access.salesperson_id
UPDATE shared_contact_access sca
SET salesperson_id = im.new_id
FROM id_mapping im
WHERE sca.salesperson_id = im.old_id;

-- Update closer_submissions.closer_id
UPDATE closer_submissions cs
SET closer_id = im.new_id
FROM id_mapping im
WHERE cs.closer_id = im.old_id;

-- Step 3: Update sales_people.id to match auth.users.id
UPDATE sales_people sp
SET id = au.id
FROM auth.users au
WHERE sp.email = au.email
AND sp.id != au.id;

-- Step 4: Recreate foreign key constraints with ON UPDATE CASCADE
ALTER TABLE assignments
ADD CONSTRAINT assignments_salesperson_id_fkey
FOREIGN KEY (salesperson_id) REFERENCES sales_people(id)
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE contacts
ADD CONSTRAINT contacts_assigned_to_fkey
FOREIGN KEY (assigned_to) REFERENCES sales_people(id)
ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE meetings
ADD CONSTRAINT meetings_salesperson_id_fkey
FOREIGN KEY (salesperson_id) REFERENCES sales_people(id)
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE resources
ADD CONSTRAINT resources_uploaded_by_fkey
FOREIGN KEY (uploaded_by) REFERENCES sales_people(id)
ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE shared_contact_access
ADD CONSTRAINT shared_contact_access_viewer_id_fkey
FOREIGN KEY (viewer_id) REFERENCES sales_people(id)
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE shared_contact_access
ADD CONSTRAINT shared_contact_access_salesperson_id_fkey
FOREIGN KEY (salesperson_id) REFERENCES sales_people(id)
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE closer_submissions
ADD CONSTRAINT closer_submissions_closer_id_fkey
FOREIGN KEY (closer_id) REFERENCES sales_people(id)
ON UPDATE CASCADE ON DELETE CASCADE;

-- Drop the temporary mapping table
DROP TABLE IF EXISTS id_mapping;
