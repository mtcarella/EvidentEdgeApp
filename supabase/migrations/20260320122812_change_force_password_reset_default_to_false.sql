/*
  # Change Force Password Reset Default to False

  1. Changes
    - Update default value of `force_password_reset` column to FALSE
    - Set all existing users to FALSE (not forced to reset)

  2. Purpose
    - Admins can manually enable this for specific users when needed
    - Users won't be forced to reset password by default
*/

ALTER TABLE sales_people 
ALTER COLUMN force_password_reset SET DEFAULT false;

UPDATE sales_people 
SET force_password_reset = false 
WHERE force_password_reset = true;
