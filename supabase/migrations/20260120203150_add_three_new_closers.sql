/*
  # Add Three New Closers
  
  1. Changes
    - Adds Marybeth, Nicholas, and Ray to the sales_people table as closers
    - All users will be active and have the 'closer' role
    - Sets default values for report requirements
  
  2. Security
    - Sets is_active to true so they appear in dropdowns
    - Not super admins by default
*/

-- Insert Marybeth as a closer
INSERT INTO sales_people (id, name, email, role, is_active, is_super_admin, requires_daily_reports, requires_weekly_reports)
VALUES (
  gen_random_uuid(),
  'Marybeth',
  'marybeth@evidenttitle.com',
  'closer',
  true,
  false,
  false,
  false
) ON CONFLICT (email) DO NOTHING;

-- Insert Nicholas as a closer
INSERT INTO sales_people (id, name, email, role, is_active, is_super_admin, requires_daily_reports, requires_weekly_reports)
VALUES (
  gen_random_uuid(),
  'Nicholas',
  'nicholas@evidenttitle.com',
  'closer',
  true,
  false,
  false,
  false
) ON CONFLICT (email) DO NOTHING;

-- Insert Ray as a closer
INSERT INTO sales_people (id, name, email, role, is_active, is_super_admin, requires_daily_reports, requires_weekly_reports)
VALUES (
  gen_random_uuid(),
  'Ray',
  'ray@evidenttitle.com',
  'closer',
  true,
  false,
  false,
  false
) ON CONFLICT (email) DO NOTHING;