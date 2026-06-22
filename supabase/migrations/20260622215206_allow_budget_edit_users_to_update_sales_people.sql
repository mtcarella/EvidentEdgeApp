CREATE POLICY "budget_edit_users_can_update_budgets" ON sales_people
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_module_permissions
      WHERE user_id = auth.uid()
        AND module_name = 'budget_edit'
        AND has_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_module_permissions
      WHERE user_id = auth.uid()
        AND module_name = 'budget_edit'
        AND has_access = true
    )
  );