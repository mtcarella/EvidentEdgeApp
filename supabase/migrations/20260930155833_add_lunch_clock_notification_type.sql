/*
# Add lunch_clock to notifications type check constraint

1. Changes
  - Drop and recreate the `notifications_type_check` constraint on the `notifications` table
  - Add `lunch_clock` and `budget_edit` to the allowed notification types
  - Existing types preserved: prospect_request, decision, general

2. Notes
  - This is needed so the lunch clock can send notifications to admins when employees clock in/out for lunch
  - Also adds budget_edit which is already used by the budget management feature
*/

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['prospect_request', 'decision', 'general', 'lunch_clock', 'budget_edit']));
