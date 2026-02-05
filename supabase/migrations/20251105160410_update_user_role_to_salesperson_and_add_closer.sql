/*
  # Update Role System: Rename 'user' to 'salesperson' and Add 'closer' Role

  1. Changes
    - Drop the existing role constraint on sales_people table
    - Add new role constraint with values: 'salesperson', 'closer', 'processor', 'admin', 'super_admin'
    - Update all existing 'user' roles to 'salesperson'
  
  2. Security
    - Maintains existing RLS policies (they check role values)
    - Preserves all existing role-based access controls
  
  3. Notes
    - Old 'user' role is renamed to 'salesperson' for clarity
    - New 'closer' role is added to the system
    - All existing users with 'user' role will be updated to 'salesperson'
*/

-- Drop the old constraint
ALTER TABLE sales_people DROP CONSTRAINT IF EXISTS sales_people_role_check;

-- Update all existing 'user' roles to 'salesperson'
UPDATE sales_people SET role = 'salesperson' WHERE role = 'user';

-- Add new constraint with updated role values
ALTER TABLE sales_people ADD CONSTRAINT sales_people_role_check 
  CHECK (role IN ('salesperson', 'closer', 'processor', 'admin', 'super_admin'));
