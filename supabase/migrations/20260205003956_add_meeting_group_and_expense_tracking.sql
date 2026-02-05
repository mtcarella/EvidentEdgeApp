/*
  # Add Meeting Group and Expense Tracking

  1. Changes
    - Add `meeting_group_id` to track meetings logged together with multiple contacts
    - Add `is_primary_for_expense` to designate which meeting in a group shows expense/receipt in exports

  2. Purpose
    - Prevents duplicate expense records in exports when one meeting is logged for multiple contacts
    - Only the primary meeting in a group will show expense/receipt data in reports

  3. Notes
    - Existing meetings will have NULL for these fields (treated as individual meetings)
    - New meetings logged with multiple contacts will have a shared group_id
    - Only one meeting per group will have is_primary_for_expense = true
*/

-- Add meeting_group_id to track related meetings logged together
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS meeting_group_id uuid;

-- Add flag to indicate which meeting should show expense in exports
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS is_primary_for_expense boolean DEFAULT true;

-- Create index for faster group lookups
CREATE INDEX IF NOT EXISTS idx_meetings_group_id ON meetings(meeting_group_id);

-- Add comment for clarity
COMMENT ON COLUMN meetings.meeting_group_id IS 'UUID linking meetings logged together for multiple contacts';
COMMENT ON COLUMN meetings.is_primary_for_expense IS 'Only true for one meeting per group; this meeting shows expense/receipt in exports';
