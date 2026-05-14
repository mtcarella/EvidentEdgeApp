/*
  # Add Chat Enabled Column

  1. Changes
    - Add `chat_enabled` column to `sales_people` table
    - Boolean column, defaults to true (chat enabled by default)
    - Allows admins to enable/disable chat feature per user

  2. Notes
    - Existing users will have chat enabled by default
    - Admins can toggle this in the user management screen
*/

ALTER TABLE sales_people
ADD COLUMN IF NOT EXISTS chat_enabled boolean NOT NULL DEFAULT true;