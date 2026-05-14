CREATE TABLE IF NOT EXISTS yankees_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_date date NOT NULL,
  game_time text DEFAULT '',
  day_of_week text DEFAULT '',
  opponent text NOT NULL DEFAULT '',
  season_year integer NOT NULL DEFAULT 2026,
  is_available boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yankees_tickets_season ON yankees_tickets(season_year);
CREATE INDEX IF NOT EXISTS idx_yankees_tickets_date ON yankees_tickets(game_date);
CREATE INDEX IF NOT EXISTS idx_yankees_tickets_available ON yankees_tickets(is_available);

ALTER TABLE yankees_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tickets" ON yankees_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can insert tickets" ON yankees_tickets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM sales_people WHERE sales_people.user_id = auth.uid() AND sales_people.role = 'super_admin'));
CREATE POLICY "Super admins can update tickets" ON yankees_tickets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM sales_people WHERE sales_people.user_id = auth.uid() AND sales_people.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM sales_people WHERE sales_people.user_id = auth.uid() AND sales_people.role = 'super_admin'));
CREATE POLICY "Super admins can delete tickets" ON yankees_tickets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM sales_people WHERE sales_people.user_id = auth.uid() AND sales_people.role = 'super_admin'));

CREATE TABLE IF NOT EXISTS yankees_ticket_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES yankees_tickets(id) ON DELETE CASCADE NOT NULL,
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requester_name text NOT NULL DEFAULT '',
  requester_email text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  client_email text NOT NULL DEFAULT '',
  game_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_notes text DEFAULT '',
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yankees_requests_status ON yankees_ticket_requests(status);
CREATE INDEX IF NOT EXISTS idx_yankees_requests_user ON yankees_ticket_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_yankees_requests_ticket ON yankees_ticket_requests(ticket_id);

ALTER TABLE yankees_ticket_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests" ON yankees_ticket_requests FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR EXISTS (SELECT 1 FROM sales_people WHERE sales_people.user_id = auth.uid() AND sales_people.role = 'super_admin'));
CREATE POLICY "Users can create own requests" ON yankees_ticket_requests FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid());
CREATE POLICY "Super admins can update requests" ON yankees_ticket_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM sales_people WHERE sales_people.user_id = auth.uid() AND sales_people.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM sales_people WHERE sales_people.user_id = auth.uid() AND sales_people.role = 'super_admin'));
CREATE POLICY "Super admins can delete requests" ON yankees_ticket_requests FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM sales_people WHERE sales_people.user_id = auth.uid() AND sales_people.role = 'super_admin'));