/*
  # Drop admin delete policy for audit_logs

  Reverts the previously added DELETE policy that allowed admins to delete audit log entries.
*/

DROP POLICY IF EXISTS "Admins can delete audit log entries" ON audit_logs;
