-- =============================================================================
-- Eterya CRM — Database Stack PART 2: schema, dati, RPC, policy
-- =============================================================================
-- Esegui DOPO 20260714_database_stack_enums.sql (commit obbligatorio tra i due).
-- Prerequisiti: supabase/schema.sql + 20260714_database_stack_enums.sql
--
-- Idempotente: sicuro da rieseguire (CREATE IF NOT EXISTS, CREATE OR REPLACE).
-- Ordine interno:
--   1 commercial_status_backfill
--   2 contact_history        (usa activity_type.visit — richiede part 1)
--   3 last_visit
--   4 follow_ups
--   5 opportunity_pipeline
--   6 products_interests
--   7 geocoding_geoapify     (usa geocode_status.completed/needs_review)
--   8 geocoding_normalized_address
--   9 visit_tours
--  10 commercial_dashboard
--   + ledger, refresh GRANT/policy, verify_database_stack()
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_schema_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_schema_migrations (name)
VALUES ('20260714_database_stack_apply')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SECTION: 20260713_commercial_status_backfill.sql
-- -----------------------------------------------------------------------------

-- Migration idempotente: backfill commercial_status per aziende esistenti
-- Esegui in Supabase Dashboard → SQL Editor (dopo o al posto della migration base)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commercial_status') THEN
    CREATE TYPE commercial_status AS ENUM (
      'prospect',
      'cliente',
      'ex_cliente',
      'da_ricontattare',
      'non_interessato'
    );
  END IF;
END $$;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS commercial_status commercial_status;

UPDATE companies
SET commercial_status = 'prospect'
WHERE commercial_status IS NULL;

ALTER TABLE companies
  ALTER COLUMN commercial_status SET DEFAULT 'prospect';

ALTER TABLE companies
  ALTER COLUMN commercial_status SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_commercial_status
  ON companies (commercial_status);

COMMENT ON COLUMN companies.commercial_status IS
  'Stato commerciale (Prospect, Cliente, Ex Cliente, Da ricontattare, Non interessato) — distinto da status (company_status)';


-- -----------------------------------------------------------------------------
-- SECTION: 20260713_contact_history.sql
-- -----------------------------------------------------------------------------

-- Storico contatti: tipologie estese, campi attività e ultimo contatto su companies
-- (Valori enum activity_type aggiunti in 20260714_database_stack_enums.sql)

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

UPDATE activities
SET occurred_at = COALESCE(completed_at, created_at)
WHERE occurred_at IS NULL;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contact_type TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_outcome TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_occurred_at ON activities (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_next_follow_up ON activities (next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_last_contact_at ON companies (last_contact_at);

-- Collega visite già completate allo storico attività
INSERT INTO activities (
  company_id,
  user_id,
  visit_id,
  type,
  title,
  description,
  status,
  completed_at,
  occurred_at,
  outcome,
  next_follow_up_at,
  metadata
)
SELECT
  v.company_id,
  v.user_id,
  v.id,
  'visit',
  'Visita',
  v.notes,
  'done',
  v.completed_at,
  v.completed_at,
  v.outcome,
  NULL::timestamptz AS next_callback_at,
  '{}'::jsonb
FROM visits v
WHERE v.status = 'completed'
  AND v.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activities a WHERE a.visit_id = v.id
  );

-- Backfill ultimo contatto da storico attività
UPDATE companies c
SET
  last_contact_at = latest.occurred_at,
  last_contact_type = latest.type::text,
  last_contact_outcome = latest.outcome
FROM (
  SELECT DISTINCT ON (company_id)
    company_id,
    occurred_at,
    type,
    outcome
  FROM activities
  WHERE company_id IS NOT NULL
    AND status = 'done'
    AND occurred_at IS NOT NULL
  ORDER BY company_id, occurred_at DESC
) latest
WHERE c.id = latest.company_id;


-- -----------------------------------------------------------------------------
-- SECTION: 20260713_last_visit.sql
-- -----------------------------------------------------------------------------

-- Ultima visita: snapshot su companies + campi storico su visits

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_visit_outcome TEXT,
  ADD COLUMN IF NOT EXISTS last_visit_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_visit_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS next_callback_at TIMESTAMPTZ;

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS next_callback_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_last_visit_at ON companies (last_visit_at);
CREATE INDEX IF NOT EXISTS idx_visits_company_completed ON visits (company_id, completed_at DESC);

-- Backfill ultima visita da storico esistente
UPDATE companies c
SET
  last_visit_at = v.completed_at,
  last_visit_outcome = v.outcome,
  last_visit_notes = v.notes,
  last_visit_duration_minutes = v.duration_minutes,
  next_callback_at = v.next_callback_at
FROM (
  SELECT DISTINCT ON (company_id)
    company_id,
    completed_at,
    outcome,
    notes,
    duration_minutes,
    next_callback_at
  FROM visits
  WHERE status = 'completed' AND completed_at IS NOT NULL
  ORDER BY company_id, completed_at DESC
) v
WHERE c.id = v.company_id;


-- -----------------------------------------------------------------------------
-- SECTION: 20260713_follow_ups.sql
-- -----------------------------------------------------------------------------

-- Follow-up e promemoria

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_up_status') THEN
    CREATE TYPE follow_up_status AS ENUM ('todo', 'completed', 'postponed', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS follow_ups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type   TEXT NOT NULL,
  description     TEXT,
  priority        activity_priority NOT NULL DEFAULT 'medium',
  status          follow_up_status NOT NULL DEFAULT 'todo',
  scheduled_at    TIMESTAMPTZ NOT NULL,
  postponed_to    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_company ON follow_ups (company_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user ON follow_ups (user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups (status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_priority ON follow_ups (priority);

DROP TRIGGER IF EXISTS trg_follow_ups_updated_at ON follow_ups;
CREATE TRIGGER trg_follow_ups_updated_at
  BEFORE UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_follow_ups" ON follow_ups;
CREATE POLICY "authenticated_all_follow_ups" ON follow_ups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Migra follow-up pianificati dallo storico contatti
INSERT INTO follow_ups (
  company_id,
  user_id,
  activity_type,
  description,
  priority,
  status,
  scheduled_at,
  created_at,
  updated_at
)
SELECT
  a.company_id,
  a.user_id,
  a.type,
  COALESCE(a.description, a.title),
  COALESCE(a.priority::activity_priority, 'medium'::activity_priority),
  'todo'::follow_up_status,
  a.next_follow_up_at,
  a.created_at,
  a.updated_at
FROM activities a
WHERE a.company_id IS NOT NULL
  AND a.next_follow_up_at IS NOT NULL
  AND a.status = 'done'
  AND a.next_follow_up_at > now()
  AND NOT EXISTS (
    SELECT 1
    FROM follow_ups f
    WHERE f.company_id = a.company_id
      AND f.scheduled_at = a.next_follow_up_at
      AND f.description IS NOT DISTINCT FROM COALESCE(a.description, a.title)
  );


-- -----------------------------------------------------------------------------
-- SECTION: 20260713_opportunity_pipeline.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- SECTION: 20260713_products_interests.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- SECTION: 20260713_geocoding_geoapify.sql
-- -----------------------------------------------------------------------------

-- Migration idempotente: campi geocoding Geoapify
-- (Valori enum geocode_status aggiunti in 20260714_database_stack_enums.sql)

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS geocoding_accuracy TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS geocoding_provider TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS geocoding_error TEXT;

COMMENT ON COLUMN companies.geocoding_accuracy IS
  'Precisione restituita dal provider (es. confidence Geoapify)';

COMMENT ON COLUMN companies.geocoding_provider IS
  'Provider usato per la geocodifica (es. geoapify)';

COMMENT ON COLUMN companies.geocoded_at IS
  'Timestamp dell''ultima geocodifica riuscita';

COMMENT ON COLUMN companies.geocoding_error IS
  'Ultimo messaggio di errore geocoding, se presente';


-- -----------------------------------------------------------------------------
-- SECTION: 20260713_geocoding_normalized_address.sql
-- -----------------------------------------------------------------------------

-- Migration idempotente: indirizzo normalizzato da Geoapify
-- Esegui in Supabase Dashboard → SQL Editor

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS geocoding_normalized_address TEXT;

COMMENT ON COLUMN companies.geocoding_normalized_address IS
  'Indirizzo formattato restituito dal provider di geocodifica';


-- -----------------------------------------------------------------------------
-- SECTION: 20260713_visit_tours.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- SECTION: 20260713_commercial_dashboard.sql
-- -----------------------------------------------------------------------------

-- Dashboard Commerciale Avanzata: layout utente + RPC aggregate ottimizzate
-- Compatibile anche se follow_ups non esiste ancora (fallback su activities.next_follow_up_at)

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  widget_order    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  hidden_widgets  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_dashboard_layouts_updated_at ON dashboard_layouts;
CREATE TRIGGER trg_dashboard_layouts_updated_at
  BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_own_dashboard_layout" ON dashboard_layouts;
CREATE POLICY "authenticated_own_dashboard_layout" ON dashboard_layouts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_visits_completed_month
  ON visits (completed_at)
  WHERE status = 'completed' AND completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_coords
  ON companies (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Conteggio follow-up di oggi: follow_ups se presente, altrimenti activities.next_follow_up_at
CREATE OR REPLACE FUNCTION dashboard_count_follow_ups_today()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  today_ts timestamptz := date_trunc('day', now());
  tomorrow_ts timestamptz := today_ts + interval '1 day';
  result integer := 0;
BEGIN
  IF to_regclass('public.follow_ups') IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO result
    FROM follow_ups f
    WHERE f.status IN ('todo', 'postponed')
      AND f.completed_at IS NULL
      AND COALESCE(
        CASE WHEN f.status = 'postponed' THEN f.postponed_to END,
        f.scheduled_at
      ) >= today_ts
      AND COALESCE(
        CASE WHEN f.status = 'postponed' THEN f.postponed_to END,
        f.scheduled_at
      ) < tomorrow_ts;
  ELSIF to_regclass('public.activities') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activities'
        AND column_name = 'next_follow_up_at'
    ) THEN
    SELECT COUNT(*)::integer INTO result
    FROM activities a
    WHERE a.status = 'done'
      AND a.next_follow_up_at IS NOT NULL
      AND a.next_follow_up_at >= today_ts
      AND a.next_follow_up_at < tomorrow_ts;
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

-- Ultima visita: companies.last_visit_at se presente, altrimenti calcolo da visits
CREATE OR REPLACE FUNCTION dashboard_company_has_last_visit_column()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'last_visit_at'
  );
$$;

CREATE OR REPLACE FUNCTION dashboard_count_never_visited_companies()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result integer := 0;
BEGIN
  IF dashboard_company_has_last_visit_column() THEN
    SELECT COUNT(*)::integer INTO result
    FROM companies
    WHERE last_visit_at IS NULL;
  ELSIF to_regclass('public.visits') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'visits'
        AND column_name = 'completed_at'
    ) THEN
    SELECT COUNT(*)::integer INTO result
    FROM companies c
    WHERE NOT EXISTS (
      SELECT 1
      FROM visits v
      WHERE v.company_id = c.id
        AND v.status = 'completed'
        AND v.completed_at IS NOT NULL
    );
  ELSE
    SELECT COUNT(*)::integer INTO result FROM companies;
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION dashboard_count_clients_without_visit_90_days()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  threshold_ts timestamptz := now() - interval '90 days';
  result integer := 0;
BEGIN
  IF dashboard_company_has_last_visit_column() THEN
    SELECT COUNT(*)::integer INTO result
    FROM companies c
    WHERE c.commercial_status = 'cliente'
      AND (c.last_visit_at IS NULL OR c.last_visit_at < threshold_ts);
  ELSIF to_regclass('public.visits') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'visits'
        AND column_name = 'completed_at'
    ) THEN
    SELECT COUNT(*)::integer INTO result
    FROM companies c
    WHERE c.commercial_status = 'cliente'
      AND (
        NOT EXISTS (
          SELECT 1
          FROM visits v
          WHERE v.company_id = c.id
            AND v.status = 'completed'
            AND v.completed_at IS NOT NULL
        )
        OR (
          SELECT MAX(v.completed_at)
          FROM visits v
          WHERE v.company_id = c.id
            AND v.status = 'completed'
            AND v.completed_at IS NOT NULL
        ) < threshold_ts
      );
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

-- Opportunità: compatibile con colonna stage (pipeline) o solo status legacy
CREATE OR REPLACE FUNCTION dashboard_opportunity_has_stage_column()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'stage'
  );
$$;

CREATE OR REPLACE FUNCTION dashboard_legacy_status_to_stage(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'accepted' THEN 'won'
    WHEN p_status IN ('rejected', 'cancelled') THEN 'lost'
    WHEN p_status = 'sent' THEN 'quote_sent'
    ELSE 'new'
  END;
$$;

CREATE OR REPLACE FUNCTION dashboard_count_open_opportunities()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result integer := 0;
BEGIN
  IF to_regclass('public.opportunities') IS NULL THEN
    RETURN 0;
  END IF;

  IF dashboard_opportunity_has_stage_column() THEN
    SELECT COUNT(*)::integer INTO result
    FROM opportunities
    WHERE stage IN ('new', 'contact_started', 'site_visit', 'quote_sent', 'negotiation');
  ELSE
    SELECT COUNT(*)::integer INTO result
    FROM opportunities
    WHERE status NOT IN ('accepted', 'rejected', 'cancelled');
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION dashboard_sum_open_pipeline_value()
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result numeric := 0;
BEGIN
  IF to_regclass('public.opportunities') IS NULL THEN
    RETURN 0;
  END IF;

  IF dashboard_opportunity_has_stage_column() THEN
    SELECT COALESCE(SUM(total_amount), 0) INTO result
    FROM opportunities
    WHERE stage IN ('new', 'contact_started', 'site_visit', 'quote_sent', 'negotiation');
  ELSE
    SELECT COALESCE(SUM(total_amount), 0) INTO result
    FROM opportunities
    WHERE status NOT IN ('accepted', 'rejected', 'cancelled');
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

-- KPI snapshot (conteggi head-only equivalenti in un round-trip)
CREATE OR REPLACE FUNCTION get_commercial_dashboard_kpis()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH today_start AS (
    SELECT date_trunc('day', now()) AS ts
  ),
  week_start AS (
    SELECT date_trunc('week', now()) AS ts
  )
  SELECT jsonb_build_object(
    'totalCompanies', (SELECT COUNT(*)::int FROM companies),
    'prospects', (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'prospect'),
    'clients', (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'cliente'),
    'exClients', (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'ex_cliente'),
    'geocodedCompanies', (
      SELECT COUNT(*)::int FROM companies
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND geocode_status IN ('geocoded', 'completed')
    ),
    'needsReviewCompanies', (
      SELECT COUNT(*)::int FROM companies WHERE geocode_status = 'needs_review'
    ),
    'visitsToday', (
      SELECT COUNT(*)::int FROM visits v, today_start t
      WHERE v.status = 'completed'
        AND v.completed_at IS NOT NULL
        AND v.completed_at >= t.ts
    ),
    'visitsThisWeek', (
      SELECT COUNT(*)::int FROM visits v, week_start w
      WHERE v.status = 'completed'
        AND v.completed_at IS NOT NULL
        AND v.completed_at >= w.ts
    ),
    'followUpsToday', dashboard_count_follow_ups_today(),
    'openOpportunities', dashboard_count_open_opportunities(),
    'pipelineValue', dashboard_sum_open_pipeline_value(),
    'neverVisitedCompanies', dashboard_count_never_visited_companies(),
    'clientsWithoutVisit90Days', dashboard_count_clients_without_visit_90_days()
  );
$$;

CREATE OR REPLACE FUNCTION get_companies_by_province_chart(p_limit int DEFAULT 12)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label', COALESCE(NULLIF(TRIM(province), ''), 'N/D'),
        'value', cnt
      )
      ORDER BY cnt DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT COALESCE(NULLIF(TRIM(province), ''), 'N/D') AS province, COUNT(*)::int AS cnt
    FROM companies
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT GREATEST(p_limit, 1)
  ) s;
$$;

CREATE OR REPLACE FUNCTION get_companies_by_commercial_status_chart()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('label', commercial_status::text, 'value', cnt)
      ORDER BY cnt DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT commercial_status, COUNT(*)::int AS cnt
    FROM companies
    GROUP BY commercial_status
  ) s;
$$;

CREATE OR REPLACE FUNCTION get_visits_monthly_trend_chart()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label', to_char(m.month_start, 'YYYY-MM'),
        'value', COALESCE(v.cnt, 0)
      )
      ORDER BY m.month_start
    ),
    '[]'::jsonb
  )
  FROM months m
  LEFT JOIN (
    SELECT date_trunc('month', completed_at) AS month_start, COUNT(*)::int AS cnt
    FROM visits
    WHERE status = 'completed' AND completed_at IS NOT NULL
      AND completed_at >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1
  ) v ON v.month_start = m.month_start;
$$;

CREATE OR REPLACE FUNCTION get_opportunities_by_stage_chart()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF to_regclass('public.opportunities') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF dashboard_opportunity_has_stage_column() THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('label', stage::text, 'value', cnt)
        ORDER BY cnt DESC
      ),
      '[]'::jsonb
    ) INTO result
    FROM (
      SELECT stage, COUNT(*)::int AS cnt
      FROM opportunities
      GROUP BY stage
    ) s;
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('label', stage_label, 'value', cnt)
        ORDER BY cnt DESC
      ),
      '[]'::jsonb
    ) INTO result
    FROM (
      SELECT dashboard_legacy_status_to_stage(status::text) AS stage_label, COUNT(*)::int AS cnt
      FROM opportunities
      GROUP BY 1
    ) s;
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION get_product_interests_chart()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('label', family, 'value', cnt)
      ORDER BY cnt DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT p.family::text AS family, COUNT(DISTINCT cpi.company_id)::int AS cnt
    FROM company_product_interests cpi
    JOIN products p ON p.id = cpi.product_id
    GROUP BY p.family
  ) s;
$$;

CREATE OR REPLACE FUNCTION get_prospect_conversion_chart()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
  ),
  new_clients AS (
    SELECT date_trunc('month', updated_at) AS month_start, COUNT(*)::int AS cnt
    FROM companies
    WHERE commercial_status = 'cliente'
      AND updated_at >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1
  ),
  totals AS (
    SELECT
      (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'prospect') AS prospects,
      (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'cliente') AS clients
  )
  SELECT jsonb_build_object(
    'monthly', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'label', to_char(m.month_start, 'YYYY-MM'),
            'value', COALESCE(nc.cnt, 0)
          )
          ORDER BY m.month_start
        )
        FROM months m
        LEFT JOIN new_clients nc ON nc.month_start = m.month_start
      ),
      '[]'::jsonb
    ),
    'conversionRate', CASE
      WHEN (totals.prospects + totals.clients) = 0 THEN 0
      ELSE ROUND((totals.clients::numeric / (totals.prospects + totals.clients)::numeric) * 100, 1)
    END,
    'prospects', totals.prospects,
    'clients', totals.clients
  )
  FROM totals;
$$;

-- -----------------------------------------------------------------------------
-- SECTION: privileges & policies refresh (post-migration)
-- -----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.follow_ups') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_all_follow_ups" ON follow_ups';
    EXECUTE 'CREATE POLICY "authenticated_all_follow_ups" ON follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.opportunity_stage_history') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_all_opportunity_stage_history" ON opportunity_stage_history';
    EXECUTE 'CREATE POLICY "authenticated_all_opportunity_stage_history" ON opportunity_stage_history FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.company_product_interests') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_all_company_product_interests" ON company_product_interests';
    EXECUTE 'CREATE POLICY "authenticated_all_company_product_interests" ON company_product_interests FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.company_product_interest_history') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_all_company_product_interest_history" ON company_product_interest_history';
    EXECUTE 'CREATE POLICY "authenticated_all_company_product_interest_history" ON company_product_interest_history FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.opportunity_products') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_all_opportunity_products" ON opportunity_products';
    EXECUTE 'CREATE POLICY "authenticated_all_opportunity_products" ON opportunity_products FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.visit_tours') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_all_visit_tours" ON visit_tours';
    EXECUTE 'CREATE POLICY "authenticated_all_visit_tours" ON visit_tours FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.dashboard_layouts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_own_dashboard_layout" ON dashboard_layouts';
    EXECUTE 'CREATE POLICY "authenticated_own_dashboard_layout" ON dashboard_layouts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- SECTION: verify_database_stack()
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_database_stack()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'commercial_status', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'commercial_status'
    ),
    'last_visit_at', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'last_visit_at'
    ),
    'follow_ups', to_regclass('public.follow_ups') IS NOT NULL,
    'opportunity_stage', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'opportunities' AND column_name = 'stage'
    ),
    'company_product_interests', to_regclass('public.company_product_interests') IS NOT NULL,
    'visit_tours', to_regclass('public.visit_tours') IS NOT NULL,
    'dashboard_layouts', to_regclass('public.dashboard_layouts') IS NOT NULL,
    'rpc_kpis', to_regprocedure('public.get_commercial_dashboard_kpis()') IS NOT NULL,
    'stack_marker', EXISTS (
      SELECT 1 FROM app_schema_migrations WHERE name = '20260714_database_stack_apply'
    ),
    'enums_marker', EXISTS (
      SELECT 1 FROM app_schema_migrations WHERE name = '20260714_database_stack_enums'
    )
  );
$$;

-- Verifica rapida (opzionale): SELECT verify_database_stack();

