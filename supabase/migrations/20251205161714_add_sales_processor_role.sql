/*
  # Add Sales Processor Role

  1. Changes
    - Add 'sales_processor' to the role check constraint for sales_people table
    - This role combines permissions from both salesperson and processor roles
    - Users with this role have dual access to:
      * All salesperson features (manage contacts, meetings, search, etc.)
      * All processor features (verify wires, processor notes, admin fields, etc.)
  
  2. Notes
    - This is for employees with dual roles who need access to both sets of features
    - Existing policies will be updated to include sales_processor role where appropriate
*/

-- Drop the existing role check constraint
ALTER TABLE sales_people 
  DROP CONSTRAINT IF EXISTS sales_people_role_check;

-- Add the new role check constraint with sales_processor included
ALTER TABLE sales_people 
  ADD CONSTRAINT sales_people_role_check 
  CHECK (role IN ('salesperson', 'closer', 'processor', 'admin', 'super_admin', 'sales_processor'));