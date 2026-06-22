/*
  # Add notes and category to itemized meeting expenses

  1. Changes
    - `meeting_expenses.notes` (text, nullable) - free-text note attached to a receipt/expense
    - `meeting_expenses.category` (text, nullable) - optional categorization of the expense

  2. Notes
    - Additive, nullable columns only. No data is modified or removed.
    - Existing RLS policies on meeting_expenses continue to govern access.
*/

ALTER TABLE meeting_expenses ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE meeting_expenses ADD COLUMN IF NOT EXISTS category text;
