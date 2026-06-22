ALTER TABLE budget_transactions ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budget_transactions_meeting_id ON budget_transactions(meeting_id) WHERE meeting_id IS NOT NULL;