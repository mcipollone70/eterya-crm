-- Opportunità commerciali: fasi pipeline e storico

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_stage') THEN
    CREATE TYPE opportunity_stage AS ENUM (
      'new',
      'contact_started',
      'site_visit',
      'quote_sent',
      'negotiation',
      'won',
      'lost'
    );
  END IF;
END $$;

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_interest TEXT,
  ADD COLUMN IF NOT EXISTS probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  ADD COLUMN IF NOT EXISTS stage opportunity_stage,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expected_close_at DATE;

UPDATE opportunities
SET
  stage = CASE
    WHEN status = 'accepted' THEN 'won'::opportunity_stage
    WHEN status = 'rejected' THEN 'lost'::opportunity_stage
    WHEN status = 'sent' THEN 'quote_sent'::opportunity_stage
    WHEN status = 'cancelled' THEN 'lost'::opportunity_stage
    ELSE 'new'::opportunity_stage
  END,
  opened_at = COALESCE(opened_at, created_at),
  probability = COALESCE(probability, 50)
WHERE stage IS NULL;

ALTER TABLE opportunities
  ALTER COLUMN stage SET DEFAULT 'new',
  ALTER COLUMN stage SET NOT NULL,
  ALTER COLUMN opened_at SET DEFAULT now();

CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage      opportunity_stage,
  to_stage        opportunity_stage NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities (stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_expected_close ON opportunities (expected_close_at);
CREATE INDEX IF NOT EXISTS idx_opportunity_stage_history_opp ON opportunity_stage_history (opportunity_id, changed_at DESC);

ALTER TABLE opportunity_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_opportunity_stage_history" ON opportunity_stage_history;
CREATE POLICY "authenticated_all_opportunity_stage_history" ON opportunity_stage_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
