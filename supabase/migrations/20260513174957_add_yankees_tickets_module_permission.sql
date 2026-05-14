INSERT INTO user_module_permissions (user_id, module_name, has_access, updated_at)
SELECT sp.id, 'yankees_tickets', true, now()
FROM sales_people sp
WHERE sp.is_active = true AND sp.role IN ('admin', 'super_admin')
ON CONFLICT (user_id, module_name) DO NOTHING;