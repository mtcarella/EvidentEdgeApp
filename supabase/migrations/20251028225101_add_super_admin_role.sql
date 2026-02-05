/*
  # Add super_admin role to sales_people

  1. Changes
    - Drop existing role check constraint
    - Add new check constraint that includes 'super_admin' role
    - Update Mike Carella to super_admin role

  2. Security
    - Maintains role-based access control
    - Adds super_admin as a valid role option
*/

-- Drop existing role constraint
ALTER TABLE sales_people DROP CONSTRAINT IF EXISTS sales_people_role_check;

-- Add new constraint with super_admin included
ALTER TABLE sales_people ADD CONSTRAINT sales_people_role_check 
CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'processor'::text, 'super_admin'::text]));

-- Update Mike Carella to super_admin
UPDATE sales_people 
SET role = 'super_admin' 
WHERE email = 'mtcarella@evidenttitle.com';
