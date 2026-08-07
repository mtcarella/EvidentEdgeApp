/*
  # Allow users with budget_requests module permission to view and manage all requests

  Updates the SELECT and UPDATE policies on contact_budget_requests to also check
  if the user has the budget_requests module permission enabled, not just super_admin role.
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own budget requests" ON contact_budget_requests;

-- Recreate with module permission check
CREATE POLICY "Users can view own budget requests"
  ON contact_budget_requests FOR SELECT
  TO authenticated
  USING (
    requesting_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM sales_people sp
      JOIN user_module_permissions ump ON ump.user_id = sp.id
      WHERE sp.user_id = auth.uid()
        AND sp.is_active = true
        AND ump.module_name = 'budget_requests'
        AND ump.has_access = true
    )
  );

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Super admins can update budget requests" ON contact_budget_requests;

-- Recreate with module permission check
CREATE POLICY "Permitted users can update budget requests"
  ON contact_budget_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM sales_people sp
      JOIN user_module_permissions ump ON ump.user_id = sp.id
      WHERE sp.user_id = auth.uid()
        AND sp.is_active = true
        AND ump.module_name = 'budget_requests'
        AND ump.has_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
        AND sales_people.role = 'super_admin'
        AND sales_people.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM sales_people sp
      JOIN user_module_permissions ump ON ump.user_id = sp.id
      WHERE sp.user_id = auth.uid()
        AND sp.is_active = true
        AND ump.module_name = 'budget_requests'
        AND ump.has_access = true
    )
  );
