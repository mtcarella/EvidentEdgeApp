/*
  # Add SELECT policy for document_Intake table

  1. Security Changes
    - Add SELECT policy on `document_Intake` for authenticated users who have file_viewer_enabled
    - This allows the File Viewer module and transaction_summary_view to return data

  2. Notes
    - Only users with file_viewer_enabled = true can read document intake records
    - This matches the existing access control pattern used in the file viewer module
*/

CREATE POLICY "Users with file viewer access can read document_Intake"
  ON "document_Intake"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.file_viewer_enabled = true
      AND sales_people.is_active = true
    )
  );
