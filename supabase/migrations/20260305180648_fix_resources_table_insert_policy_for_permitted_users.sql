/*
  # Fix Resources Table Insert Policy for Permitted Users

  1. Changes
    - Updates the INSERT policy on the resources table
    - Allows users with 'upload_resource' module permission to insert resource records
    - Previously only admin/super_admin could insert records

  2. Security
    - Users must be authenticated and active
    - Users must either be admin/super_admin OR have explicit upload_resource permission
    - Matches the storage.objects INSERT policy for consistency
*/

DROP POLICY IF EXISTS "Admins can insert resources" ON resources;

CREATE POLICY "Users with upload permission can insert resources"
  ON resources
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM user_module_permissions ump
      JOIN sales_people sp ON sp.user_id = ump.user_id
      WHERE ump.user_id = auth.uid()
      AND ump.module_name = 'upload_resource'
      AND ump.has_access = true
      AND sp.is_active = true
    )
  );
