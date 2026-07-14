-- Catalogo prodotti, interessi azienda e collegamento opportunità

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_family') THEN
    CREATE TYPE product_family AS ENUM (
      'zanzariere',
      'tapparelle',
      'vepa',
      'tende_cristal',
      'tende_tecniche_rullo'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_interest_level') THEN
    CREATE TYPE product_interest_level AS ENUM ('low', 'medium', 'high');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_product_relation') THEN
    CREATE TYPE company_product_relation AS ENUM ('interest', 'purchased');
  END IF;
END $$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS family product_family,
  ADD COLUMN IF NOT EXISTS price_range_min NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS price_range_max NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE products
SET family = CASE
  WHEN category ILIKE '%zanzariere%' THEN 'zanzariere'::product_family
  WHEN category ILIKE '%tapparelle%' THEN 'tapparelle'::product_family
  WHEN category ILIKE '%vepa%' THEN 'vepa'::product_family
  WHEN category ILIKE '%cristal%' THEN 'tende_cristal'::product_family
  WHEN category ILIKE '%rullo%' THEN 'tende_tecniche_rullo'::product_family
  ELSE 'zanzariere'::product_family
END
WHERE family IS NULL;

ALTER TABLE products
  ALTER COLUMN family SET DEFAULT 'zanzariere',
  ALTER COLUMN family SET NOT NULL;

CREATE TABLE IF NOT EXISTS company_product_interests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relation_type     company_product_relation NOT NULL DEFAULT 'interest',
  interest_level    product_interest_level,
  last_interest_at  TIMESTAMPTZ,
  commercial_notes  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT company_product_interests_unique UNIQUE (company_id, product_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_company_product_interests_company ON company_product_interests (company_id);
CREATE INDEX IF NOT EXISTS idx_company_product_interests_product ON company_product_interests (product_id);
CREATE INDEX IF NOT EXISTS idx_company_product_interests_relation ON company_product_interests (relation_type);
CREATE INDEX IF NOT EXISTS idx_company_product_interests_level ON company_product_interests (interest_level);

DROP TRIGGER IF EXISTS trg_company_product_interests_updated_at ON company_product_interests;
CREATE TRIGGER trg_company_product_interests_updated_at
  BEFORE UPDATE ON company_product_interests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS company_product_interest_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relation_type   company_product_relation NOT NULL,
  interest_level  product_interest_level,
  event_type      TEXT NOT NULL,
  notes           TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_company_product_interest_history_company
  ON company_product_interest_history (company_id, occurred_at DESC);

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS product_family product_family;

UPDATE opportunities
SET product_family = 'zanzariere'::product_family
WHERE product_family IS NULL;

ALTER TABLE opportunities
  ALTER COLUMN product_family SET DEFAULT 'zanzariere',
  ALTER COLUMN product_family SET NOT NULL;

CREATE TABLE IF NOT EXISTS opportunity_products (
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (opportunity_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_products_product ON opportunity_products (product_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_product_family ON opportunities (product_family);

-- Catalogo iniziale (una voce per famiglia)
INSERT INTO products (name, family, description, is_active, price_range_min, price_range_max, notes)
SELECT v.name, v.family, v.description, true, v.price_min, v.price_max, v.notes
FROM (
  VALUES
    ('Zanzariere standard', 'zanzariere'::product_family, 'Zanzariere a rullo e plissettate', 150::numeric, 800::numeric, 'Catalogo base'),
    ('Tapparelle in alluminio', 'tapparelle'::product_family, 'Tapparelle motorizzate e manuali', 200::numeric, 1200::numeric, 'Catalogo base'),
    ('Sistema VEPA', 'vepa'::product_family, 'Ventilazione con recupero calore', 800::numeric, 5000::numeric, 'Catalogo base'),
    ('Tende Cristal', 'tende_cristal'::product_family, 'Chiusure trasparenti per esterni', 500::numeric, 4000::numeric, 'Catalogo base'),
    ('Tende tecniche a rullo', 'tende_tecniche_rullo'::product_family, 'Schermature solari verticali', 300::numeric, 2500::numeric, 'Catalogo base')
) AS v(name, family, description, price_min, price_max, notes)
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

ALTER TABLE company_product_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_product_interest_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_company_product_interests" ON company_product_interests;
CREATE POLICY "authenticated_all_company_product_interests" ON company_product_interests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_company_product_interest_history" ON company_product_interest_history;
CREATE POLICY "authenticated_all_company_product_interest_history" ON company_product_interest_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_opportunity_products" ON opportunity_products;
CREATE POLICY "authenticated_all_opportunity_products" ON opportunity_products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
