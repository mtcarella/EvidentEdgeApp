/*
  # Fix wire verification logs loan_number constraint

  1. Changes
    - Make loan_number column nullable in wire_verification_logs table
    - This allows logs to be created even when loan number is not provided
*/

ALTER TABLE wire_verification_logs 
ALTER COLUMN loan_number DROP NOT NULL;
