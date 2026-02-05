/*
  # Create Meetings Table

  ## Summary
  This migration creates a meetings table to track all meetings between salespeople and contacts.
  Each meeting includes the date, notes, and references to both the contact and the salesperson who logged it.

  ## 1. New Tables
    - `meetings`
      - `id` (uuid, primary key) - Unique identifier for the meeting
      - `contact_id` (uuid, foreign key) - Reference to the contact the meeting was with
      - `salesperson_id` (uuid, foreign key) - Reference to the salesperson who had the meeting
      - `meeting_date` (date) - Date when the meeting occurred
      - `notes` (text) - Notes about what was discussed in the meeting
      - `created_by` (uuid, foreign key) - User who created this meeting entry
      - `created_at` (timestamptz) - When this record was created
      - `updated_at` (timestamptz) - When this record was last updated

  ## 2. Security (RLS Policies)
    - Enable RLS on meetings table
    - Users can view meetings for contacts assigned to them
    - Users can insert meetings for contacts assigned to them
    - Users can update meetings they created
    - Users can delete meetings they created
    - Admins can view, insert, update, and delete all meetings

  ## 3. Performance
    - Add indexes on foreign keys for better query performance
    - Add composite index on (contact_id, meeting_date) for filtering

  ## 4. Important Notes
    - Meetings are tied to contacts via contact_id
    - When a contact is deleted, all associated meetings are deleted (CASCADE)
    - Meeting dates can be edited to correct mistakes
    - All meetings are automatically timestamped
*/

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  salesperson_id uuid NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_contact_id ON meetings(contact_id);
CREATE INDEX IF NOT EXISTS idx_meetings_salesperson_id ON meetings(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_contact_date ON meetings(contact_id, meeting_date DESC);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for SELECT
CREATE POLICY "Users can view meetings for their contacts"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      JOIN sales_people ON assignments.salesperson_id = sales_people.id
      WHERE assignments.contact_id = meetings.contact_id
      AND sales_people.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can view all meetings"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- RLS Policies for INSERT
CREATE POLICY "Users can insert meetings for their contacts"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM assignments
      JOIN sales_people ON assignments.salesperson_id = sales_people.id
      WHERE assignments.contact_id = meetings.contact_id
      AND sales_people.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can insert any meeting"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- RLS Policies for UPDATE
CREATE POLICY "Users can update meetings they created"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Admins can update any meeting"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- RLS Policies for DELETE
CREATE POLICY "Users can delete meetings they created"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Admins can delete any meeting"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );
