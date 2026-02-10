/*
  # Add Announcements Module Permissions

  This migration adds the necessary module permissions for the announcements feature.

  ## New Modules Added
  1. `announcements` - Allows users to view announcements archive
  2. `manage_announcements` - Allows admins to create/edit/delete announcements

  ## Security
  - All users get access to view announcements by default
  - Only admins get access to manage announcements

  ## Changes
  - Inserts default permissions for all existing users
  - Admins automatically get manage_announcements permission
*/

DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id, role FROM sales_people WHERE is_active = true LOOP
    INSERT INTO user_module_permissions (user_id, module_name, has_access)
    VALUES (user_record.id, 'announcements', true)
    ON CONFLICT (user_id, module_name) DO NOTHING;

    IF user_record.role IN ('admin', 'super_admin') THEN
      INSERT INTO user_module_permissions (user_id, module_name, has_access)
      VALUES (user_record.id, 'manage_announcements', true)
      ON CONFLICT (user_id, module_name) DO NOTHING;
    END IF;
  END LOOP;
END $$;
