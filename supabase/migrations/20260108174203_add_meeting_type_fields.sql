/*
  # Add Meeting Type Fields to Meetings Table

  ## Summary
  This migration adds four boolean fields to the meetings table to identify the type of interaction:
  - Meeting (in-person or virtual meeting)
  - Text (text message)
  - Call (phone call)
  - Email (email correspondence)

  ## 1. Changes to Tables
    - `meetings` table:
      - Add `is_meeting` (boolean, default false) - Indicates if this was a meeting
      - Add `is_text` (boolean, default false) - Indicates if this was a text message
      - Add `is_call` (boolean, default false) - Indicates if this was a phone call
      - Add `is_email` (boolean, default false) - Indicates if this was an email

  ## 2. Important Notes
    - All fields default to false
    - Users can select multiple types if applicable (e.g., a meeting followed by an email)
    - These fields help categorize and track different types of client interactions
*/

-- Add meeting type boolean fields to meetings table
ALTER TABLE meetings 
  ADD COLUMN IF NOT EXISTS is_meeting boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_text boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_call boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_email boolean DEFAULT false;
