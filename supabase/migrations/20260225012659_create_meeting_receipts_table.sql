/*
  # Create Meeting Receipts Table for Multiple Receipt Support

  1. New Tables
    - `meeting_receipts`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to meetings)
      - `file_path` (text, storage path)
      - `file_name` (text, original filename for display)
      - `created_at` (timestamptz)
      - `created_by` (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on `meeting_receipts` table
    - Add policies for authenticated users to manage their own receipts
    - Cascade delete when meeting is deleted

  3. Notes
    - Existing single receipt_url in meetings table is preserved for backwards compatibility
    - New receipts should be added to meeting_receipts table
*/

-- Create meeting_receipts table
CREATE TABLE IF NOT EXISTS meeting_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meeting_receipts_meeting_id ON meeting_receipts(meeting_id);

-- Enable RLS
ALTER TABLE meeting_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view receipts for meetings they can access
CREATE POLICY "Users can view receipts for accessible meetings"
  ON meeting_receipts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN sales_people sp ON m.salesperson_id = sp.id
      WHERE m.id = meeting_receipts.meeting_id
      AND (
        sp.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM sales_people admin_sp
          WHERE admin_sp.user_id = auth.uid()
          AND admin_sp.role IN ('admin', 'super_admin', 'processor', 'sales_processor')
        )
      )
    )
  );

-- Policy: Users can insert receipts for their own meetings
CREATE POLICY "Users can insert receipts for own meetings"
  ON meeting_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN sales_people sp ON m.salesperson_id = sp.id
      WHERE m.id = meeting_receipts.meeting_id
      AND (
        sp.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM sales_people admin_sp
          WHERE admin_sp.user_id = auth.uid()
          AND admin_sp.role IN ('admin', 'super_admin')
        )
      )
    )
  );

-- Policy: Users can delete receipts they created or admins can delete any
CREATE POLICY "Users can delete own receipts or admins any"
  ON meeting_receipts
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sales_people sp
      WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin', 'super_admin')
    )
  );
