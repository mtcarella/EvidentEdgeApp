/*
# Allow users to delete their own assigned contacts

Previously, only admins/super_admins could delete rows from the `contacts` table.
Regular salespeople clicking Delete on one of their assigned contacts would see
a UI success message, but Postgres RLS silently prevented the delete (0 rows
affected, no error). This migration adds a DELETE policy so a user can delete
any contact assigned to them via the `assignments` table.

1. Security
   - New DELETE policy `Users can delete their assigned contacts` on `contacts`.
   - Scoped to `authenticated`; predicate requires an `assignments` row linking
     the current `auth.uid()` to the contact.
   - The existing admin delete policy remains — admins/super_admins can still
     delete any contact.

2. Audit
   - The pre-existing `audit_contacts` DELETE trigger already writes to
     `audit_logs`, so every successful deletion is now recorded and visible to
     admins in the Audit Log view.
*/

DROP POLICY IF EXISTS "Users can delete their assigned contacts" ON contacts;

CREATE POLICY "Users can delete their assigned contacts"
ON contacts FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.contact_id = contacts.id
      AND assignments.salesperson_id = auth.uid()
  )
);
