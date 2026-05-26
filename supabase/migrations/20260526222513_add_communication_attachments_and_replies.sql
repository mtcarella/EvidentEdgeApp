/*
  # Add file attachments and message replies to communication_logs

  1. Modified Tables
    - `communication_logs`
      - Added `reply_to_message_id` (uuid, nullable) - references the parent message for threaded replies

  2. New Tables
    - `communication_attachments`
      - `id` (uuid, primary key)
      - `communication_id` (uuid, foreign key to communication_logs)
      - `file_name` (text) - original file name
      - `file_url` (text) - Supabase storage URL
      - `file_type` (text) - MIME type
      - `file_size` (integer) - size in bytes
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `communication_attachments`
    - Admins can view all attachments
    - Users can view attachments for communications they sent or received
    - Authenticated users can insert attachments

  4. Storage
    - Creates `communication-attachments` bucket for file uploads
*/

-- Add reply_to_message_id column to communication_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_logs' AND column_name = 'reply_to_message_id'
  ) THEN
    ALTER TABLE communication_logs ADD COLUMN reply_to_message_id uuid REFERENCES communication_logs(id);
  END IF;
END $$;

-- Create communication_attachments table
CREATE TABLE IF NOT EXISTS communication_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES communication_logs(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE communication_attachments ENABLE ROW LEVEL SECURITY;

-- Admins can view all attachments
CREATE POLICY "Admins can view all attachments"
  ON communication_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('super_admin', 'admin')
    )
  );

-- Users can view attachments for messages they sent or received
CREATE POLICY "Users can view own communication attachments"
  ON communication_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM communication_logs
      WHERE communication_logs.id = communication_attachments.communication_id
      AND (
        communication_logs.sent_by = auth.uid()
        OR communication_logs.recipient_ids @> jsonb_build_array(auth.uid()::text)
      )
    )
  );

-- Authenticated users can insert attachments
CREATE POLICY "Authenticated users can insert attachments"
  ON communication_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create storage bucket for communication attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('communication-attachments', 'communication-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for communication-attachments bucket
CREATE POLICY "Authenticated users can upload communication attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'communication-attachments');

CREATE POLICY "Anyone can view communication attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'communication-attachments');

CREATE POLICY "Users can delete own communication attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'communication-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
