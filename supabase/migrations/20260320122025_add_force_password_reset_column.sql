/*
  # Add Force Password Reset Column

  1. Changes
    - Add `force_password_reset` boolean column to `sales_people` table
    - Default value is TRUE so all existing and new users will be required to reset password
    - Column is NOT NULL to ensure every user has this flag set

  2. Purpose
    - Allows administrators to force users to update their passwords on next login
    - All existing users will be required to reset their password
*/

ALTER TABLE sales_people 
ADD COLUMN IF NOT EXISTS force_password_reset boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN sales_people.force_password_reset IS 'When true, user must reset their password before accessing the application';
