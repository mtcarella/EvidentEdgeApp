/*
  # Remove admin delete policy for audit_logs

  Removes the ability for admins and super admins to delete audit log entries.
*/

DROP POLICY IF EXISTS "Admins can delete audit log entries" ON audit_logs;
