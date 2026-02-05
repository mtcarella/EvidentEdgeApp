/*
  # Backfill assigned_to column for existing contacts

  ## Changes Made
  This migration updates all existing contacts to populate the assigned_to field
  based on their entries in the assignments table.

  ## Details
  - For contacts with assignments, sets assigned_to to their assigned salesperson
  - Only updates contacts where assigned_to is currently NULL
  - Uses the first assignment if a contact has multiple assignments

  ## Important Notes
  - This is a data migration to fix historical data
  - Future contacts will have assigned_to set when created
  - This ensures the My Contacts view works correctly
*/

-- Update contacts with their assigned salesperson from the assignments table
UPDATE contacts c
SET assigned_to = (
  SELECT a.salesperson_id 
  FROM assignments a 
  WHERE a.contact_id = c.id 
  LIMIT 1
)
WHERE c.assigned_to IS NULL
AND EXISTS (
  SELECT 1 FROM assignments a WHERE a.contact_id = c.id
);
