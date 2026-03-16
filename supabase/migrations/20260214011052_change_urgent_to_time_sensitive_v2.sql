/*
  # Change Announcement Category from 'urgent' to 'time sensitive'

  This migration corrects the announcement category terminology:
  - Removes the CHECK constraint that includes 'urgent'
  - Updates all existing announcements with category='urgent' to category='time sensitive'
  - Adds a new CHECK constraint with 'time sensitive' instead

  ## Changes
  1. Schema Changes (First)
     - Drops the existing CHECK constraint on announcements.category

  2. Data Migration
     - Updates all announcements records with category='urgent' to 'time sensitive'

  3. Schema Changes (Final)
     - Creates new CHECK constraint with allowed values: 'time sensitive', 'informational', 'procedural'

  ## Important Notes
  - This change ensures the "time sensitive" terminology is enforced at the database level
  - Prevents future creation of announcements with 'urgent' category
  - Maintains data integrity by dropping constraint before updating records
*/

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE announcements
DROP CONSTRAINT IF EXISTS announcements_category_check;

-- Step 2: Update all existing announcements with 'urgent' to 'time sensitive'
UPDATE announcements
SET category = 'time sensitive'
WHERE category = 'urgent';

-- Step 3: Add new CHECK constraint with 'time sensitive' instead of 'urgent'
ALTER TABLE announcements
ADD CONSTRAINT announcements_category_check 
CHECK (category IN ('time sensitive', 'informational', 'procedural'));
