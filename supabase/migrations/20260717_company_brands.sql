-- Marchi aziendali e associazione N:N con aziende (company_brands).
-- Fase 1 database: nessun seed fittizio; catalogo marchi da popolare in seguito.

CREATE TABLE IF NOT EXISTS brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  short_code  TEXT,
  color       TEXT,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT brands_name_unique UNIQUE (name),
  CONSTRAINT brands_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS company_brands (
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (company_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_company_brands_company_id
  ON company_brands (company_id);

CREATE INDEX IF NOT EXISTS idx_company_brands_brand_id
  ON company_brands (brand_id);

-- Un solo marchio principale per azienda (più associazioni non-primary ammesse).
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_brands_one_primary_per_company
  ON company_brands (company_id)
  WHERE is_primary = true;

DROP TRIGGER IF EXISTS trg_brands_updated_at ON brands;
CREATE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_brands" ON brands;
CREATE POLICY "authenticated_all_brands" ON brands
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_company_brands" ON company_brands;
CREATE POLICY "authenticated_all_company_brands" ON company_brands
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Single-tenant: privilegi DML espliciti (allineati a policies.sql / stack apply).
GRANT SELECT, INSERT, UPDATE, DELETE ON brands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_brands TO authenticated;
