/*
  # Fix Security and Performance Issues

  ## Changes Made

  1. **Performance Improvements - Add Missing Indexes**
     - Add index on `sales_people.user_id` (foreign key to auth.users)
     - Add index on `verified_wires.created_by` (foreign key to auth.users)
     - Add index on `wire_verification_logs.created_by` (foreign key to auth.users)
     - Add index on `wire_verification_logs.verified_wire_id` (foreign key to verified_wires)
     - Remove unused index `idx_contacts_created_by`

  2. **RLS Performance Optimization**
     - Fix `Super admins can delete verified wires` policy to use `(select auth.uid())`
     - Fix `Super admins can update verified wires` policy to use `(select auth.uid())`
     - This prevents re-evaluation of auth functions for each row

  3. **Extension Schema Fix**
     - Move `pg_net` extension from public schema to extensions schema

  ## Security Notes
  - All indexes improve query performance for foreign key lookups
  - RLS policy optimization prevents performance degradation at scale
  - Extension isolation follows security best practices
*/

-- 1. Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_sales_people_user_id ON public.sales_people(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_wires_created_by ON public.verified_wires(created_by);
CREATE INDEX IF NOT EXISTS idx_wire_verification_logs_created_by ON public.wire_verification_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_wire_verification_logs_verified_wire_id ON public.wire_verification_logs(verified_wire_id);

-- 2. Remove unused index
DROP INDEX IF EXISTS public.idx_contacts_created_by;

-- 3. Fix RLS policies to use (select auth.uid()) for better performance
DROP POLICY IF EXISTS "Super admins can update verified wires" ON public.verified_wires;
CREATE POLICY "Super admins can update verified wires"
  ON public.verified_wires
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );

DROP POLICY IF EXISTS "Super admins can delete verified wires" ON public.verified_wires;
CREATE POLICY "Super admins can delete verified wires"
  ON public.verified_wires
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_people
      WHERE sales_people.user_id = (select auth.uid())
      AND sales_people.role = 'super_admin'
      AND sales_people.is_active = true
    )
  );

-- 4. Move pg_net extension from public to extensions schema
-- First create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop from public and recreate in extensions schema
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
