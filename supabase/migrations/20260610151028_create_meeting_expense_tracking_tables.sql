/*
  # Meeting Expense & Receipt Tracking

  1. New Tables
    - `meeting_expenses` (id, meeting_id, amount, date, created_by, created_at)
    - `meeting_expense_receipts` (id, meeting_id, amount, date, created_by, created_at)
    Both store simple amount + date entries that sum into a meeting total on the frontend.

  2. Security
    - RLS enabled on both tables.
    - Access (select/insert/update/delete) limited to the meeting creator
      (meetings.created_by or the owning salesperson) and module-authorized
      roles (admin, super_admin, processor, sales_processor).
    - Rows cascade-delete with their meeting.

  3. Notes
    - These are independent of the existing file-based `meeting_receipts` table,
      which continues to handle uploaded receipt images.
*/

CREATE TABLE IF NOT EXISTS meeting_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_expense_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_expenses_meeting_id ON meeting_expenses(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_expense_receipts_meeting_id ON meeting_expense_receipts(meeting_id);

ALTER TABLE meeting_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_expense_receipts ENABLE ROW LEVEL SECURITY;

-- meeting_expenses policies
CREATE POLICY "select_meeting_expenses" ON meeting_expenses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expenses.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  );

CREATE POLICY "insert_meeting_expenses" ON meeting_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expenses.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  );

CREATE POLICY "update_meeting_expenses" ON meeting_expenses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expenses.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expenses.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  );

CREATE POLICY "delete_meeting_expenses" ON meeting_expenses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expenses.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  );

-- meeting_expense_receipts policies
CREATE POLICY "select_meeting_expense_receipts" ON meeting_expense_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expense_receipts.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  );

CREATE POLICY "insert_meeting_expense_receipts" ON meeting_expense_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expense_receipts.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  );

CREATE POLICY "update_meeting_expense_receipts" ON meeting_expense_receipts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expense_receipts.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expense_receipts.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  );

CREATE POLICY "delete_meeting_expense_receipts" ON meeting_expense_receipts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_expense_receipts.meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM sales_people sp WHERE sp.id = m.salesperson_id AND sp.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM sales_people admin_sp WHERE admin_sp.user_id = auth.uid() AND admin_sp.role IN ('admin','super_admin','processor','sales_processor'))
      )
    )
  );
