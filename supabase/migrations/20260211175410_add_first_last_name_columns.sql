/*
  # Add First Name and Last Name Columns to Contacts

  1. Schema Changes
    - Add `first_name` column (varchar 50) for storing first name
    - Add `last_name` column (varchar 50) for storing last name  
    - Add `original_name` column to backup existing name data
    - Add `name_needs_review` boolean flag for records requiring manual review

  2. Data Migration
    - Backup all existing names to original_name column
    - Parse existing names using intelligent splitting algorithm
    - Handle edge cases: suffixes (Esq., Jr., Sr., III), hyphenated names, 
      multi-part names, parenthetical notes, and capitalization normalization

  3. Important Notes
    - Original 'name' column is preserved and will be computed from first_name + last_name
    - Records with unusual patterns are flagged for manual review
    - Capitalization is normalized (Title Case)
*/

-- Add new columns
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS original_name TEXT,
ADD COLUMN IF NOT EXISTS name_needs_review BOOLEAN DEFAULT false;

-- Backup existing names
UPDATE contacts 
SET original_name = name 
WHERE original_name IS NULL AND name IS NOT NULL;

-- Create a function to properly capitalize names
CREATE OR REPLACE FUNCTION proper_name_case(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  word TEXT;
  words TEXT[];
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Split by spaces
  words := string_to_array(lower(input_text), ' ');
  
  FOR i IN 1..array_length(words, 1) LOOP
    word := words[i];
    
    -- Handle hyphenated names
    IF position('-' in word) > 0 THEN
      word := (
        SELECT string_agg(initcap(part), '-')
        FROM unnest(string_to_array(word, '-')) AS part
      );
    -- Handle names with apostrophes (O'Brien, D'Angelo)
    ELSIF position('''' in word) > 0 THEN
      word := (
        SELECT string_agg(initcap(part), '''')
        FROM unnest(string_to_array(word, '''')) AS part
      );
    -- Handle "Mc" and "Mac" prefixes
    ELSIF lower(word) LIKE 'mc%' AND length(word) > 2 THEN
      word := 'Mc' || initcap(substring(word from 3));
    ELSIF lower(word) LIKE 'mac%' AND length(word) > 3 THEN
      word := 'Mac' || initcap(substring(word from 4));
    ELSE
      word := initcap(word);
    END IF;
    
    IF result = '' THEN
      result := word;
    ELSE
      result := result || ' ' || word;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to parse full name into first and last
CREATE OR REPLACE FUNCTION parse_contact_name(full_name TEXT)
RETURNS TABLE(parsed_first_name TEXT, parsed_last_name TEXT, needs_review BOOLEAN) AS $$
DECLARE
  cleaned_name TEXT;
  name_parts TEXT[];
  part_count INT;
  first_part TEXT;
  last_part TEXT;
  suffix_pattern TEXT := '\s+(Esq\.?|Jr\.?|Sr\.?|III|II|IV|MD|PhD|DDS|CPA)$';
  suffix TEXT := '';
  parenthetical TEXT := '';
  review_flag BOOLEAN := false;
BEGIN
  IF full_name IS NULL OR trim(full_name) = '' THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;
  
  cleaned_name := trim(full_name);
  
  -- Extract and remove parenthetical content
  IF cleaned_name ~ '\([^)]+\)' THEN
    parenthetical := substring(cleaned_name from '\([^)]+\)');
    cleaned_name := trim(regexp_replace(cleaned_name, '\([^)]+\)', ''));
  END IF;
  
  -- Extract suffix if present
  IF cleaned_name ~* suffix_pattern THEN
    suffix := trim(substring(cleaned_name from suffix_pattern));
    cleaned_name := trim(regexp_replace(cleaned_name, suffix_pattern, '', 'i'));
  END IF;
  
  -- Split into parts
  name_parts := string_to_array(trim(cleaned_name), ' ');
  part_count := array_length(name_parts, 1);
  
  IF part_count IS NULL OR part_count = 0 THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;
  
  IF part_count = 1 THEN
    -- Single name goes to first name
    first_part := proper_name_case(name_parts[1]);
    last_part := '';
  ELSIF part_count = 2 THEN
    -- Simple first last
    first_part := proper_name_case(name_parts[1]);
    last_part := proper_name_case(name_parts[2]);
  ELSIF part_count = 3 THEN
    -- Check for common patterns like "Van Der" prefix
    IF lower(name_parts[1]) IN ('van', 'von', 'de', 'del', 'della', 'di', 'da', 'le', 'la') THEN
      first_part := '';
      last_part := proper_name_case(array_to_string(name_parts, ' '));
      review_flag := true;
    ELSIF lower(name_parts[2]) IN ('van', 'von', 'de', 'del', 'della', 'di', 'da', 'le', 'la') THEN
      first_part := proper_name_case(name_parts[1]);
      last_part := proper_name_case(name_parts[2] || ' ' || name_parts[3]);
    ELSE
      -- First name + middle goes to first, last word is last name
      first_part := proper_name_case(name_parts[1] || ' ' || name_parts[2]);
      last_part := proper_name_case(name_parts[3]);
    END IF;
  ELSE
    -- 4+ parts - first two to first name, rest to last (flag for review)
    first_part := proper_name_case(name_parts[1]);
    last_part := proper_name_case(array_to_string(name_parts[2:part_count], ' '));
    review_flag := true;
  END IF;
  
  -- Add suffix back to last name if present
  IF suffix != '' AND last_part != '' THEN
    last_part := last_part || ' ' || suffix;
  ELSIF suffix != '' THEN
    last_part := suffix;
  END IF;
  
  RETURN QUERY SELECT 
    substring(first_part from 1 for 50),
    substring(last_part from 1 for 50),
    review_flag;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Parse and populate name fields for all existing contacts
UPDATE contacts
SET 
  first_name = parsed.parsed_first_name,
  last_name = parsed.parsed_last_name,
  name_needs_review = parsed.needs_review
FROM (
  SELECT 
    c.id,
    (parse_contact_name(c.name)).*
  FROM contacts c
  WHERE c.first_name IS NULL
) AS parsed
WHERE contacts.id = parsed.id;

-- Create a trigger to keep the name field in sync
CREATE OR REPLACE FUNCTION sync_contact_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL THEN
    NEW.name := trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_contact_name_trigger ON contacts;
CREATE TRIGGER sync_contact_name_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sync_contact_name();

-- Add check constraints for character limits
ALTER TABLE contacts 
ADD CONSTRAINT check_first_name_length CHECK (length(first_name) <= 50),
ADD CONSTRAINT check_last_name_length CHECK (length(last_name) <= 50);

-- Create index for faster searching by name parts
CREATE INDEX IF NOT EXISTS idx_contacts_first_name ON contacts(first_name);
CREATE INDEX IF NOT EXISTS idx_contacts_last_name ON contacts(last_name);
