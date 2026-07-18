-- Relazione commerciale per singolo marchio (company_brands).
-- Non migra/elimina companies.commercial_status (compatibilità UI legacy).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brand_relationship_status') THEN
    CREATE TYPE brand_relationship_status AS ENUM (
      'prospect',
      'customer',
      'former_customer'
    );
  END IF;
END $$;

ALTER TABLE company_brands
  ADD COLUMN IF NOT EXISTS relationship_status brand_relationship_status NOT NULL DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS customer_code TEXT,
  ADD COLUMN IF NOT EXISTS relationship_started_at DATE,
  ADD COLUMN IF NOT EXISTS relationship_ended_at DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_company_brands_relationship_status
  ON company_brands (relationship_status);

CREATE INDEX IF NOT EXISTS idx_company_brands_brand_relationship
  ON company_brands (brand_id, relationship_status);

-- Un solo primario per azienda: già presente da 20260717_company_brands.sql
-- (idx_company_brands_one_primary_per_company WHERE is_primary = true).

DROP TRIGGER IF EXISTS trg_company_brands_updated_at ON company_brands;
CREATE TRIGGER trg_company_brands_updated_at
  BEFORE UPDATE ON company_brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS già abilitate in fase 1; ri-afferma policy + GRANT (idempotente).
ALTER TABLE company_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_company_brands" ON company_brands;
CREATE POLICY "authenticated_all_company_brands" ON company_brands
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON company_brands TO authenticated;

COMMENT ON COLUMN company_brands.relationship_status IS
  'Stato commerciale sul singolo marchio (prospect | customer | former_customer). Distinto da companies.commercial_status (legacy UI).';
