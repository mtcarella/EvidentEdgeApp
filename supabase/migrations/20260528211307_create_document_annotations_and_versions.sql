/*
  # Create document annotations and version history system

  1. New Tables
    - `document_annotations`
      - `id` (uuid, primary key)
      - `document_path` (text) - storage path of the document
      - `type` (text) - highlight, drawing, text-note, arrow
      - `coordinates` (jsonb) - percentage-based x, y, width, height
      - `points` (jsonb) - array of percentage-based points for drawings
      - `content` (text) - text content for notes
      - `color` (text) - annotation color
      - `author_id` (uuid) - references auth.users
      - `author_name` (text) - display name snapshot
      - `page_number` (integer) - for multi-page documents
      - `text_anchor` (jsonb) - start/end offset and node text for re-anchoring
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `version_id` (uuid) - references document_versions
    - `document_versions`
      - `id` (uuid, primary key)
      - `document_path` (text) - storage path of the document
      - `file_url` (text) - URL to the versioned file snapshot in storage
      - `saved_by_id` (uuid) - references auth.users
      - `saved_by_name` (text) - display name snapshot
      - `saved_at` (timestamptz)
      - `annotations_snapshot` (jsonb) - full annotation state at save time
      - `changes_summary` (text) - human-readable summary of changes
      - `version_number` (integer) - sequential version number per document

  2. Security
    - Enable RLS on both tables
    - Authenticated users can read annotations for documents they can access
    - Users can create/update/delete their own annotations
    - All authenticated users can view version history
    - Only the saving user can create versions
*/

-- Document versions table (referenced by annotations)
CREATE TABLE IF NOT EXISTS document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_path text NOT NULL,
  file_url text,
  saved_by_id uuid NOT NULL REFERENCES auth.users(id),
  saved_by_name text NOT NULL DEFAULT '',
  saved_at timestamptz NOT NULL DEFAULT now(),
  annotations_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  changes_summary text NOT NULL DEFAULT '',
  version_number integer NOT NULL DEFAULT 1
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view document versions"
  ON document_versions
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create document versions"
  ON document_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = saved_by_id);

-- Document annotations table
CREATE TABLE IF NOT EXISTS document_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_path text NOT NULL,
  type text NOT NULL CHECK (type IN ('highlight', 'drawing', 'text-note', 'arrow')),
  coordinates jsonb NOT NULL DEFAULT '{}'::jsonb,
  points jsonb,
  content text,
  color text NOT NULL DEFAULT '#ef4444',
  author_id uuid NOT NULL REFERENCES auth.users(id),
  author_name text NOT NULL DEFAULT '',
  page_number integer,
  text_anchor jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version_id uuid REFERENCES document_versions(id)
);

ALTER TABLE document_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view annotations"
  ON document_annotations
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create annotations"
  ON document_annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own annotations"
  ON document_annotations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete own annotations"
  ON document_annotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_annotations_path ON document_annotations(document_path);
CREATE INDEX IF NOT EXISTS idx_document_annotations_author ON document_annotations(author_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_path ON document_versions(document_path);
CREATE INDEX IF NOT EXISTS idx_document_versions_number ON document_versions(document_path, version_number);
