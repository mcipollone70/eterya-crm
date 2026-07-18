-- Gestione Campioni — campioni prodotto consegnati alle aziende
-- Modulo 5: tracciamento campioni fisici (consegna, restituzione, esito).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sample_status') THEN
    CREATE TYPE sample_status AS ENUM (
      'consegnato',
      'restituito',
      'acquistato',
      'perso'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS product_samples (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id         UUID REFERENCES products(id) ON DELETE SET NULL,
  contact_id         UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status             sample_status NOT NULL DEFAULT 'consegnato',
  given_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_at DATE,
  returned_at        TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_samples_company ON product_samples (company_id);
CREATE INDEX IF NOT EXISTS idx_product_samples_product ON product_samples (product_id);
CREATE INDEX IF NOT EXISTS idx_product_samples_user ON product_samples (user_id);
CREATE INDEX IF NOT EXISTS idx_product_samples_status ON product_samples (status);
CREATE INDEX IF NOT EXISTS idx_product_samples_given ON product_samples (given_at DESC);

DROP TRIGGER IF EXISTS trg_product_samples_updated_at ON product_samples;
CREATE TRIGGER trg_product_samples_updated_at
  BEFORE UPDATE ON product_samples
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE product_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_product_samples" ON product_samples;
CREATE POLICY "authenticated_all_product_samples" ON product_samples
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
