/*
  # Add admin delete policy for audit_logs

  Allows admin and super_admin users to delete audit log entries.
*/

CREATE POLICY "Admins can delete audit log entries"
  ON audit_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
      AND sales_people.is_active = true
    )
  );
