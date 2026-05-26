/*
  # Fix encryption functions to use schema-qualified pgcrypto calls

  1. Changes
    - Update `encrypt_wire_data` function to use `extensions.digest()` and
      `extensions.pgp_sym_encrypt()` since pgcrypto is installed in the
      `extensions` schema.
    - This fixes the "function digest(unknown, unknown) does not exist" error
      that prevented inserting new verified wires.
*/

CREATE OR REPLACE FUNCTION encrypt_wire_data(data text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := encode(extensions.digest('EVIDENT_WIRE_ENCRYPTION_KEY_2024', 'sha256'), 'hex');
  RETURN extensions.pgp_sym_encrypt(data, encryption_key);
END;
$$;
