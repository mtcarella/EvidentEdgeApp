-- Part 4: Vault-backed wire encryption
-- 1. Generate a strong random key, store in supabase_vault.
-- 2. Rewrite encrypt_wire_data / decrypt_wire_data to read the key from the vault.
-- 3. Re-encrypt every verified_wires row from plaintext using the new key.
-- 4. Drop plaintext columns once encryption is in place.

-- Step 1: ensure pgcrypto is available in extensions schema (already installed),
-- and create vault secret if it doesn't exist.
DO $$
DECLARE
  existing_secret_id uuid;
BEGIN
  SELECT id INTO existing_secret_id FROM vault.secrets WHERE name = 'wire_encryption_key';
  IF existing_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'wire_encryption_key',
      'AES key used to encrypt verified_wires routing/account numbers'
    );
  END IF;
END $$;

-- Step 2: rewrite functions to read key from vault.
CREATE OR REPLACE FUNCTION public.encrypt_wire_data(data text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  encryption_key text;
BEGIN
  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'wire_encryption_key'
  LIMIT 1;

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'wire_encryption_key not configured in vault';
  END IF;

  RETURN extensions.pgp_sym_encrypt(data, encryption_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_wire_data(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'wire_encryption_key'
  LIMIT 1;

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'wire_encryption_key not configured in vault';
  END IF;

  RETURN extensions.pgp_sym_decrypt(encrypted_data, encryption_key);
END;
$$;

-- Step 3: re-encrypt every row from plaintext using new vault-backed key.
UPDATE verified_wires
SET routing_number_encrypted = public.encrypt_wire_data(routing_number),
    account_number_encrypted = public.encrypt_wire_data(account_number)
WHERE routing_number IS NOT NULL OR account_number IS NOT NULL;

-- Step 4: verify all rows now have encrypted data, then drop plaintext columns.
DO $$
DECLARE
  unencrypted_count integer;
BEGIN
  SELECT count(*) INTO unencrypted_count
  FROM verified_wires
  WHERE (routing_number IS NOT NULL AND routing_number_encrypted IS NULL)
     OR (account_number IS NOT NULL AND account_number_encrypted IS NULL);

  IF unencrypted_count > 0 THEN
    RAISE EXCEPTION 'Aborting: % rows still have unencrypted plaintext-only data', unencrypted_count;
  END IF;
END $$;

-- Make sure existing trigger that copies plaintext into encrypted columns is dropped,
-- since the plaintext columns are about to disappear.
DROP TRIGGER IF EXISTS encrypt_verified_wires_on_insert_trigger ON verified_wires;
DROP FUNCTION IF EXISTS public.encrypt_verified_wires_on_insert() CASCADE;

ALTER TABLE verified_wires DROP COLUMN IF EXISTS routing_number;
ALTER TABLE verified_wires DROP COLUMN IF EXISTS account_number;
