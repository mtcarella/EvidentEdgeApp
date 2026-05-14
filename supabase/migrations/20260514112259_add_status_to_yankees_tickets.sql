/*
  # Add pending status tracking to Yankees tickets

  1. Schema Changes
    - Add `status` column to `yankees_tickets` with allowed values:
      'available', 'pending', 'unavailable'
    - Backfill `status` based on existing `is_available` column

  2. Triggers
    - On INSERT into `yankees_ticket_requests` with status='pending',
      automatically set the parent ticket's status to 'pending'.
    - On UPDATE of `yankees_ticket_requests`:
      - When the request becomes 'approved', set ticket to 'unavailable'.
      - When the request becomes 'denied', if no other pending requests
        exist for the same ticket, set ticket back to 'available'.
    - Trigger functions run with SECURITY DEFINER so they bypass RLS,
      allowing regular users to indirectly flip a ticket to 'pending'
      via the request flow without granting broad UPDATE rights.

  3. Notes
    - `is_available` is preserved for backward compatibility; the trigger
      keeps it in sync with `status` for any existing consumers.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yankees_tickets' AND column_name = 'status'
  ) THEN
    ALTER TABLE yankees_tickets
      ADD COLUMN status text NOT NULL DEFAULT 'available'
      CHECK (status IN ('available', 'pending', 'unavailable'));
  END IF;
END $$;

UPDATE yankees_tickets
SET status = CASE WHEN is_available THEN 'available' ELSE 'unavailable' END
WHERE status IS NULL OR status = 'available' AND NOT is_available;

CREATE OR REPLACE FUNCTION sync_yankees_ticket_status_on_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    UPDATE yankees_tickets
      SET status = 'pending',
          is_available = false,
          updated_at = now()
      WHERE id = NEW.ticket_id
        AND status = 'available';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_yankees_ticket_status_on_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_pending integer;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE yankees_tickets
      SET status = 'unavailable',
          is_available = false,
          updated_at = now()
      WHERE id = NEW.ticket_id;
  ELSIF NEW.status = 'denied' AND OLD.status IS DISTINCT FROM 'denied' THEN
    SELECT COUNT(*) INTO remaining_pending
      FROM yankees_ticket_requests
      WHERE ticket_id = NEW.ticket_id
        AND status = 'pending'
        AND id <> NEW.id;
    IF remaining_pending = 0 THEN
      UPDATE yankees_tickets
        SET status = 'available',
            is_available = true,
            updated_at = now()
        WHERE id = NEW.ticket_id
          AND status = 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_yankees_request_insert_sync ON yankees_ticket_requests;
CREATE TRIGGER trg_yankees_request_insert_sync
  AFTER INSERT ON yankees_ticket_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_yankees_ticket_status_on_request_insert();

DROP TRIGGER IF EXISTS trg_yankees_request_update_sync ON yankees_ticket_requests;
CREATE TRIGGER trg_yankees_request_update_sync
  AFTER UPDATE ON yankees_ticket_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_yankees_ticket_status_on_request_update();
