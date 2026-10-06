/*
# Add Lunch Clock Module Permission (v3)

Enables the lunch_clock module for all active sales people.
user_module_permissions.user_id references sales_people.id (not auth user_id).
*/

INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT sp.id, 'lunch_clock', true
FROM sales_people sp
WHERE sp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_module_permissions ump
    WHERE ump.user_id = sp.id AND ump.module_name = 'lunch_clock'
  );
