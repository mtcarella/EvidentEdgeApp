/*
  # Add phone field to verified_wires table

  1. Changes
    - Add phone field to verified_wires table
    - Phone is optional (nullable)

  2. Notes
    - This allows storing contact phone numbers with wire verification information
*/

-- Add phone field to verified_wires table
ALTER TABLE verified_wires 
  ADD COLUMN IF NOT EXISTS phone text;
