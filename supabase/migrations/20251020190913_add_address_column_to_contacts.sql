/*
  # Add address column to contacts table

  ## Changes Made
  This migration adds an address field to the contacts table to store contact addresses.

  ## Details
  1. New Column
    - `address` (text, nullable) - Stores the contact's address

  ## Important Notes
  - This is a non-breaking change
  - Existing contacts will have NULL for address
  - Address field is optional
*/

-- Add address column to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS address text;
