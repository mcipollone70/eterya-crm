-- Giri visite salvati (ottimizzazione multi-tappa)

CREATE TABLE IF NOT EXISTS visit_tours (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tour_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  mode                TEXT NOT NULL DEFAULT 'optimize',
  origin              JSONB NOT NULL,
  destination         JSONB NOT NULL,
  constraints         JSONB NOT NULL DEFAULT '{}',
  stops               JSONB NOT NULL DEFAULT '[]',
  total_distance_km   NUMERIC(10, 2),
  estimated_minutes   INTEGER,
  deviation_km        NUMERIC(10, 2),
  status              TEXT NOT NULL DEFAULT 'draft',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_tours_user ON visit_tours (user_id, tour_date DESC);
CREATE INDEX IF NOT EXISTS idx_visit_tours_status ON visit_tours (status);

DROP TRIGGER IF EXISTS trg_visit_tours_updated_at ON visit_tours;
CREATE TRIGGER trg_visit_tours_updated_at
  BEFORE UPDATE ON visit_tours
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE visit_tours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_visit_tours" ON visit_tours;
CREATE POLICY "authenticated_all_visit_tours" ON visit_tours
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
