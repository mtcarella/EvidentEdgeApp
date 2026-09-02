/*
# Add giveaway_inventory module permission for all active users

Enables the giveaway_inventory module for all existing active sales people
so they can access the Giveaway Item Inventory tab immediately.
The user_module_permissions.user_id FK references sales_people.id.
*/

INSERT INTO user_module_permissions (user_id, module_name, has_access)
SELECT sp.id, 'giveaway_inventory', true
FROM sales_people sp
WHERE sp.is_active = true
ON CONFLICT DO NOTHING;