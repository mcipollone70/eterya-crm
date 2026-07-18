-- Gestione Assistenza — ticket di assistenza post-vendita
-- Modulo 6: interventi/ticket collegati ad aziende e prodotti.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_ticket_status') THEN
    CREATE TYPE service_ticket_status AS ENUM (
      'aperto',
      'in_lavorazione',
      'in_attesa',
      'risolto',
      'chiuso'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number        TEXT,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'assistenza',
  status        service_ticket_status NOT NULL DEFAULT 'aperto',
  priority      activity_priority NOT NULL DEFAULT 'medium',
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at  TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  closed_at     TIMESTAMPTZ,
  resolution    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_tickets_company ON service_tickets (company_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_product ON service_tickets (product_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_user ON service_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON service_tickets (status);
CREATE INDEX IF NOT EXISTS idx_service_tickets_opened ON service_tickets (opened_at DESC);

DROP TRIGGER IF EXISTS trg_service_tickets_updated_at ON service_tickets;
CREATE TRIGGER trg_service_tickets_updated_at
  BEFORE UPDATE ON service_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE service_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_service_tickets" ON service_tickets;
CREATE POLICY "authenticated_all_service_tickets" ON service_tickets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
