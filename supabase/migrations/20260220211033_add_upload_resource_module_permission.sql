/*
  # Add Upload Resource Module Permission

  1. Changes
    - Adds a new 'upload_resource' module permission
    - Grants this permission to admin and super_admin users
  
  2. Security
    - Only admin and super_admin roles will have access to the upload resource feature
*/

DO $$
BEGIN
  INSERT INTO user_module_permissions (user_id, module_name, has_access)
  SELECT sp.id, 'upload_resource', true
  FROM sales_people sp
  WHERE sp.role IN ('admin', 'super_admin')
    AND sp.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM user_module_permissions ump 
      WHERE ump.user_id = sp.id 
      AND ump.module_name = 'upload_resource'
    );
END $$;
