/*
  # Remove Manage Permissions Module

  1. Changes
    - Remove 'manage_permissions' module from user_module_permissions table
    - This module is no longer needed as all admins and super admins automatically have permission to manage user permissions
  
  2. Rationale
    - Simplifies permission system by removing an unnecessary toggle
    - Admin and super admin roles inherently have permission to manage other users' permissions
*/

-- Remove all manage_permissions records from user_module_permissions
DELETE FROM user_module_permissions 
WHERE module_name = 'manage_permissions';
