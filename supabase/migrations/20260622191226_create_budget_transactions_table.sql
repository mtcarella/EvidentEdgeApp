-- Budget transaction log table to track all budget credits and debits
CREATE TABLE budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sales_person_id UUID NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL DEFAULT '',
  budget_type TEXT NOT NULL DEFAULT 'regular' CHECK (budget_type IN ('regular', 'gas')),
  balance_after NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookups by user
CREATE INDEX idx_budget_transactions_user ON budget_transactions(sales_person_id, created_at DESC);
CREATE INDEX idx_budget_transactions_type ON budget_transactions(type);
CREATE INDEX idx_budget_transactions_category ON budget_transactions(category);

-- Enable RLS
ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "select_own_budget_transactions" ON budget_transactions FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND (sales_people.role IN ('admin', 'super_admin') OR sales_people.is_super_admin = true)
    )
  );

-- Only admins/super_admins can insert transactions
CREATE POLICY "insert_budget_transactions" ON budget_transactions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_people
      WHERE sales_people.user_id = auth.uid()
      AND (sales_people.role IN ('admin', 'super_admin') OR sales_people.is_super_admin = true)
    )
    OR user_id = auth.uid()
  );

-- No updates allowed (transactions are immutable)
-- No deletes allowed (transactions are immutable)
