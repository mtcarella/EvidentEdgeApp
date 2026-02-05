/*
  # Add Delete Policy for Closer Submissions

  1. Changes
    - Add DELETE policy for closers to delete their own submissions
    
  2. Security
    - Closers can only delete submissions where closer_id matches their auth.uid()
    - Must be an active closer in the sales_people table
*/

-- Allow closers to delete their own submissions
CREATE POLICY "Closers can delete own submissions"
  ON closer_submissions
  FOR DELETE
  TO authenticated
  USING (
    closer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.id = auth.uid()
      AND sales_people.role = 'closer'
      AND sales_people.is_active = true
    )
  );
