/*
  # Add Direct Messages Module Permission

  1. Changes
    - Add 'direct_messages' module to default modules for all users
    - This enables all active users to access the interoffice messaging feature

  2. Security
    - All users get access to direct messaging by default
    - RLS on the direct_messages tables ensures users can only see their own conversations
*/

-- Add direct_messages permission for all existing active users who don't already have it
-- Note: user_module_permissions.user_id references sales_people.id (not auth.users)
INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT sp.id, 'direct_messages', true
FROM sales_people sp
WHERE sp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id
    AND ump.module_name = 'direct_messages'
  )
ON CONFLICT (user_id, module_name) DO NOTHING;
