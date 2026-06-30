-- Allow admins to update budget transactions (description, amount only)
CREATE POLICY "update_budget_transactions_admin" ON budget_transactions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND (sales_people.role IN ('admin', 'super_admin') OR sales_people.is_super_admin = true)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND (sales_people.role IN ('admin', 'super_admin') OR sales_people.is_super_admin = true)
    )
  );

-- Allow admins to delete budget transactions
CREATE POLICY "delete_budget_transactions_admin" ON budget_transactions FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND (sales_people.role IN ('admin', 'super_admin') OR sales_people.is_super_admin = true)
    )
  );
