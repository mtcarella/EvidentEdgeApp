/*
  # Create Document Intake Table

  1. New Tables
    - `document_intake`
      - `id` (uuid, primary key)
      - `file_id` (text, unique identifier for the file)
      - `file_name` (text, original file name)
      - `file_type` (text, MIME type or extension)
      - `file_size` (bigint, size in bytes)
      - `content` (text, extracted content or description)
      - `description` (text, user-provided description)
      - `tags` (text[], array of tags)
      - `notes` (text, additional notes)
      - `status` (text, current status)
      - `processing_stage` (text, current processing stage)
      - `error_message` (text, any error encountered)
      - `source` (text, origin source)
      - `uploaded_by` (text, who uploaded)
      - `origin_system` (text, originating system)
      - `intake_date` (timestamptz, when the document was received)
      - `processed_at` (timestamptz, when processing completed)
      - `created_at` (timestamptz, record creation)
      - `updated_at` (timestamptz, last update)

  2. Security
    - Enable RLS on `document_intake` table
    - Add policy for authenticated users with file_viewer_enabled to read data

  3. Notes
    - file_id is the primary search field and has a unique index
    - Tags stored as text array for flexible categorization
*/

CREATE TABLE IF NOT EXISTS document_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id text UNIQUE NOT NULL,
  file_name text NOT NULL DEFAULT '',
  file_type text DEFAULT '',
  file_size bigint DEFAULT 0,
  content text DEFAULT '',
  description text DEFAULT '',
  tags text[] DEFAULT '{}',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  processing_stage text DEFAULT '',
  error_message text DEFAULT '',
  source text DEFAULT '',
  uploaded_by text DEFAULT '',
  origin_system text DEFAULT '',
  intake_date timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE document_intake ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_document_intake_file_id ON document_intake (file_id);
CREATE INDEX IF NOT EXISTS idx_document_intake_file_name ON document_intake (file_name);
CREATE INDEX IF NOT EXISTS idx_document_intake_status ON document_intake (status);
CREATE INDEX IF NOT EXISTS idx_document_intake_intake_date ON document_intake (intake_date);

CREATE POLICY "Authenticated users with file_viewer access can read document_intake"
  ON document_intake
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
