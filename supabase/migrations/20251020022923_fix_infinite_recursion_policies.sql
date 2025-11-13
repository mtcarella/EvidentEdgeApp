/*
  # Fix Infinite Recursion in Sales People Policies

  ## Changes Made
    - Remove policies that cause infinite recursion (admin policies that query sales_people)
    - Add policy to allow new user signup (service role can insert)
    - Simplify policies to avoid recursive checks
    - Keep basic policies for authenticated users

  ## Security Changes
    - Service role can insert new sales people (needed for signup)
    - Authenticated users can view all salespeople
    - Users can update their own record
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can delete salespeople" ON sales_people;
DROP POLICY IF EXISTS "Admins can insert salespeople" ON sales_people;
DROP POLICY IF EXISTS "Admins can update any salesperson" ON sales_people;
DROP POLICY IF EXISTS "Users can update own record" ON sales_people;
DROP POLICY IF EXISTS "Users can view own record" ON sales_people;
DROP POLICY IF EXISTS "Authenticated users can view all salespeople" ON sales_people;

-- Allow service role to insert (needed for signup)
CREATE POLICY "Service role can insert salespeople"
  ON sales_people FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated role to insert (needed for signup via auth context)
CREATE POLICY "Authenticated users can insert during signup"
  ON sales_people FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow all authenticated users to view salespeople
CREATE POLICY "Authenticated users can view salespeople"
  ON sales_people FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to update their own record
CREATE POLICY "Users can update own profile"
  ON sales_people FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
