/*
  # Add assigned_to column to contacts table

  1. Changes
    - Add assigned_to column to contacts table (uuid, nullable)
    - Add foreign key constraint referencing sales_people.id
    - This enables tracking which salesperson owns each contact

  2. Security
    - No RLS changes needed
    - Foreign key ensures data integrity
*/

-- Add assigned_to column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE contacts ADD COLUMN assigned_to uuid;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'contacts_assigned_to_fkey'
    AND table_name = 'contacts'
  ) THEN
    ALTER TABLE contacts
    ADD CONSTRAINT contacts_assigned_to_fkey
    FOREIGN KEY (assigned_to)
    REFERENCES sales_people(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);
