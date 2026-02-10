/*
  # Create Announcements System

  This migration creates the database structure for a comprehensive announcement
  feature that allows administrators to post procedural updates and users to
  track which announcements they've read.

  ## New Tables

  1. `announcements`
    - `id` (uuid, primary key) - Unique identifier
    - `title` (text) - Announcement title/headline
    - `content` (text) - Full announcement content (supports markdown)
    - `category` (text) - Category type: 'urgent', 'informational', 'procedural'
    - `is_active` (boolean) - Whether announcement is currently visible
    - `is_pinned` (boolean) - Whether to pin at top of list
    - `created_by` (uuid) - User who created the announcement
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp
    - `expires_at` (timestamptz) - Optional expiration date

  2. `announcement_reads`
    - `id` (uuid, primary key) - Unique identifier
    - `announcement_id` (uuid) - Reference to announcement
    - `user_id` (uuid) - User who read the announcement
    - `read_at` (timestamptz) - When user read/dismissed the announcement

  ## Security
    - RLS enabled on both tables
    - All authenticated users can read active announcements
    - Only admins/super_admins can create/update/delete announcements
    - Users can only manage their own read receipts

  ## Indexes
    - Index on announcements.category for filtering
    - Index on announcements.created_at for sorting
    - Index on announcement_reads for user lookups
*/

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'informational' CHECK (category IN ('urgent', 'informational', 'procedural')),
  is_active boolean NOT NULL DEFAULT true,
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- Create announcement_reads table to track user read status
CREATE TABLE IF NOT EXISTS announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_category ON announcements(category);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);

-- Enable RLS on announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view active announcements
CREATE POLICY "Users can view active announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Policy: Admins can view all announcements (including inactive)
CREATE POLICY "Admins can view all announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins can insert announcements
CREATE POLICY "Admins can create announcements"
  ON announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins can update announcements
CREATE POLICY "Admins can update announcements"
  ON announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins can delete announcements
CREATE POLICY "Admins can delete announcements"
  ON announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND sales_people.role IN ('admin', 'super_admin')
    )
  );

-- Enable RLS on announcement_reads
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own read receipts
CREATE POLICY "Users can view own read receipts"
  ON announcement_reads
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can mark announcements as read
CREATE POLICY "Users can mark announcements as read"
  ON announcement_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own read receipts (to mark as unread)
CREATE POLICY "Users can delete own read receipts"
  ON announcement_reads
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS announcement_updated_at ON announcements;
CREATE TRIGGER announcement_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcement_updated_at();
