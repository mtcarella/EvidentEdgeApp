-- Add per-receipt amount and an UPDATE policy so receipts can be edited.

ALTER TABLE meeting_receipts
  ADD COLUMN IF NOT EXISTS amount numeric(10,2) NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Users can update receipts for accessible meetings" ON meeting_receipts;
CREATE POLICY "Users can update receipts for accessible meetings"
  ON meeting_receipts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN sales_people sp ON m.salesperson_id = sp.id
      WHERE m.id = meeting_receipts.meeting_id
      AND (
        sp.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM sales_people admin_sp
          WHERE admin_sp.user_id = auth.uid()
          AND admin_sp.role IN ('admin', 'super_admin', 'processor', 'sales_processor')
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN sales_people sp ON m.salesperson_id = sp.id
      WHERE m.id = meeting_receipts.meeting_id
      AND (
        sp.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM sales_people admin_sp
          WHERE admin_sp.user_id = auth.uid()
          AND admin_sp.role IN ('admin', 'super_admin', 'processor', 'sales_processor')
        )
      )
    )
  );
