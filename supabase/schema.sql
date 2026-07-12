-- =============================================================================
-- Eterya CRM — PostgreSQL Schema
-- Target: Supabase (PostgreSQL 15+ / PostGIS)
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =============================================================================
-- ENUM Types
-- =============================================================================

CREATE TYPE user_role AS ENUM (
  'super_admin', 'org_admin', 'manager', 'agent', 'viewer'
);

CREATE TYPE company_status AS ENUM (
  'active', 'inactive', 'prospect', 'lead', 'archived'
);

CREATE TYPE geocode_status AS ENUM (
  'not_geocoded', 'geocoded', 'pending', 'failed'
);

CREATE TYPE activity_type AS ENUM (
  'call', 'email', 'task', 'follow_up', 'meeting'
);

CREATE TYPE activity_status AS ENUM (
  'todo', 'in_progress', 'done', 'cancelled'
);

CREATE TYPE visit_status AS ENUM (
  'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'
);

CREATE TYPE voice_note_status AS ENUM (
  'recorded', 'transcribing', 'transcribed', 'processed', 'failed'
);

CREATE TYPE opportunity_status AS ENUM (
  'draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'
);

CREATE TYPE attachment_entity_type AS ENUM (
  'company', 'contact', 'activity', 'visit', 'voice_note', 'opportunity', 'product'
);

CREATE TYPE activity_priority AS ENUM (
  'low', 'medium', 'high'
);

-- =============================================================================
-- Utility: auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- USERS (profilo esteso di auth.users)
-- =============================================================================

CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        user_role NOT NULL DEFAULT 'agent',
  avatar_url  TEXT,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_is_active ON users (is_active) WHERE is_active = true;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- COMPANIES
-- Campi strutturati + 76 slot posizionali Excel + payload JSONB per zero data loss
-- =============================================================================

CREATE TABLE companies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Anagrafica
  name                TEXT NOT NULL,
  legal_name          TEXT,
  vat_number          TEXT,
  tax_code            TEXT,
  rea_number          TEXT,
  cciaa               TEXT,
  legal_form          TEXT,

  -- Indirizzo
  address             TEXT,
  street              TEXT,
  street_number       TEXT,
  postal_code         TEXT,
  city                TEXT,
  province            TEXT,
  region              TEXT,
  country             TEXT NOT NULL DEFAULT 'IT',

  -- Contatti azienda
  phone               TEXT,
  phone_secondary     TEXT,
  fax                 TEXT,
  mobile              TEXT,
  email               TEXT,
  pec                 TEXT,
  website             TEXT,

  -- Referente principale (denormalizzato da Excel)
  contact_name        TEXT,
  contact_role        TEXT,
  contact_phone       TEXT,
  contact_email       TEXT,

  -- Classificazione commerciale
  status              company_status NOT NULL DEFAULT 'prospect',
  category            TEXT,
  subcategory         TEXT,
  sector              TEXT,
  ateco_code          TEXT,
  ateco_description   TEXT,
  agent_code          TEXT,
  zone                TEXT,
  area                TEXT,
  price_list          TEXT,
  discount            NUMERIC(5, 2),
  credit_limit        NUMERIC(14, 2),
  revenue             NUMERIC(14, 2),
  employees           INTEGER,
  founding_date       DATE,

  -- Note
  notes               TEXT,
  internal_notes      TEXT,

  -- Geolocalizzazione
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  location            GEOGRAPHY(POINT, 4326),
  geocode_status      geocode_status NOT NULL DEFAULT 'not_geocoded',

  -- Tracciamento import Excel
  import_source       TEXT,
  import_file_name    TEXT,
  import_row_index    INTEGER,
  import_headers      TEXT[] NOT NULL DEFAULT '{}',
  import_payload      JSONB NOT NULL DEFAULT '{}',
  import_column_count SMALLINT NOT NULL DEFAULT 0
    CHECK (import_column_count >= 0 AND import_column_count <= 76),

  -- Ricerca full-text
  search_vector       TSVECTOR,

  -- 76 colonne Excel posizionali (zero data loss)
  excel_col_001 TEXT, excel_col_002 TEXT, excel_col_003 TEXT, excel_col_004 TEXT,
  excel_col_005 TEXT, excel_col_006 TEXT, excel_col_007 TEXT, excel_col_008 TEXT,
  excel_col_009 TEXT, excel_col_010 TEXT, excel_col_011 TEXT, excel_col_012 TEXT,
  excel_col_013 TEXT, excel_col_014 TEXT, excel_col_015 TEXT, excel_col_016 TEXT,
  excel_col_017 TEXT, excel_col_018 TEXT, excel_col_019 TEXT, excel_col_020 TEXT,
  excel_col_021 TEXT, excel_col_022 TEXT, excel_col_023 TEXT, excel_col_024 TEXT,
  excel_col_025 TEXT, excel_col_026 TEXT, excel_col_027 TEXT, excel_col_028 TEXT,
  excel_col_029 TEXT, excel_col_030 TEXT, excel_col_031 TEXT, excel_col_032 TEXT,
  excel_col_033 TEXT, excel_col_034 TEXT, excel_col_035 TEXT, excel_col_036 TEXT,
  excel_col_037 TEXT, excel_col_038 TEXT, excel_col_039 TEXT, excel_col_040 TEXT,
  excel_col_041 TEXT, excel_col_042 TEXT, excel_col_043 TEXT, excel_col_044 TEXT,
  excel_col_045 TEXT, excel_col_046 TEXT, excel_col_047 TEXT, excel_col_048 TEXT,
  excel_col_049 TEXT, excel_col_050 TEXT, excel_col_051 TEXT, excel_col_052 TEXT,
  excel_col_053 TEXT, excel_col_054 TEXT, excel_col_055 TEXT, excel_col_056 TEXT,
  excel_col_057 TEXT, excel_col_058 TEXT, excel_col_059 TEXT, excel_col_060 TEXT,
  excel_col_061 TEXT, excel_col_062 TEXT, excel_col_063 TEXT, excel_col_064 TEXT,
  excel_col_065 TEXT, excel_col_066 TEXT, excel_col_067 TEXT, excel_col_068 TEXT,
  excel_col_069 TEXT, excel_col_070 TEXT, excel_col_071 TEXT, excel_col_072 TEXT,
  excel_col_073 TEXT, excel_col_074 TEXT, excel_col_075 TEXT, excel_col_076 TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT companies_vat_number_format
    CHECK (vat_number IS NULL OR length(vat_number) <= 16),
  CONSTRAINT companies_tax_code_format
    CHECK (tax_code IS NULL OR length(tax_code) <= 16)
);

CREATE INDEX idx_companies_assigned_user ON companies (assigned_user_id);
CREATE INDEX idx_companies_status ON companies (status);
CREATE INDEX idx_companies_vat_number ON companies (vat_number) WHERE vat_number IS NOT NULL;
CREATE INDEX idx_companies_tax_code ON companies (tax_code) WHERE tax_code IS NOT NULL;
CREATE INDEX idx_companies_city ON companies (city);
CREATE INDEX idx_companies_province ON companies (province);
CREATE INDEX idx_companies_postal_code ON companies (postal_code);
CREATE INDEX idx_companies_geocode_status ON companies (geocode_status);
CREATE INDEX idx_companies_name_trgm ON companies USING GIN (name gin_trgm_ops);
CREATE INDEX idx_companies_search ON companies USING GIN (search_vector);
CREATE INDEX idx_companies_import_payload ON companies USING GIN (import_payload);
CREATE INDEX idx_companies_location ON companies USING GIST (location);
CREATE UNIQUE INDEX idx_companies_vat_unique ON companies (vat_number)
  WHERE vat_number IS NOT NULL AND vat_number <> '';

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION sync_company_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_sync_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON companies
  FOR EACH ROW EXECUTE FUNCTION sync_company_location();

CREATE OR REPLACE FUNCTION sync_company_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('italian', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('italian', coalesce(NEW.legal_name, '')), 'A') ||
    setweight(to_tsvector('italian', coalesce(NEW.vat_number, '')), 'B') ||
    setweight(to_tsvector('italian', coalesce(NEW.tax_code, '')), 'B') ||
    setweight(to_tsvector('italian', coalesce(NEW.city, '')), 'C') ||
    setweight(to_tsvector('italian', coalesce(NEW.address, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_search_vector
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION sync_company_search_vector();

-- =============================================================================
-- CONTACTS
-- =============================================================================

CREATE TABLE contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  mobile      TEXT,
  role        TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_company ON contacts (company_id);
CREATE INDEX idx_contacts_email ON contacts (email) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_primary ON contacts (company_id, is_primary) WHERE is_primary = true;

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ACTIVITIES
-- =============================================================================

CREATE TABLE activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_id      UUID,
  type          activity_type NOT NULL DEFAULT 'task',
  title         TEXT NOT NULL,
  description   TEXT,
  status        activity_status NOT NULL DEFAULT 'todo',
  priority      activity_priority NOT NULL DEFAULT 'medium',
  due_at        TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_company ON activities (company_id);
CREATE INDEX idx_activities_user ON activities (user_id);
CREATE INDEX idx_activities_status ON activities (status);
CREATE INDEX idx_activities_due_at ON activities (due_at) WHERE due_at IS NOT NULL;
CREATE INDEX idx_activities_user_status ON activities (user_id, status);

CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- VISITS
-- =============================================================================

CREATE TABLE visits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at        TIMESTAMPTZ NOT NULL,
  completed_at        TIMESTAMPTZ,
  status              visit_status NOT NULL DEFAULT 'scheduled',
  outcome             TEXT,
  notes               TEXT,
  check_in_latitude   DOUBLE PRECISION,
  check_in_longitude  DOUBLE PRECISION,
  check_in_location   GEOGRAPHY(POINT, 4326),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visits_company ON visits (company_id);
CREATE INDEX idx_visits_user ON visits (user_id);
CREATE INDEX idx_visits_scheduled ON visits (scheduled_at);
CREATE INDEX idx_visits_status ON visits (status);
CREATE INDEX idx_visits_user_scheduled ON visits (user_id, scheduled_at);

CREATE TRIGGER trg_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE activities
  ADD CONSTRAINT activities_visit_id_fkey
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL;

-- =============================================================================
-- VOICE NOTES
-- =============================================================================

CREATE TABLE voice_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id       UUID REFERENCES activities(id) ON DELETE SET NULL,
  visit_id          UUID REFERENCES visits(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  storage_path      TEXT,
  duration_seconds  INTEGER,
  status            voice_note_status NOT NULL DEFAULT 'recorded',
  transcription     TEXT,
  ai_summary        JSONB,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_notes_company ON voice_notes (company_id);
CREATE INDEX idx_voice_notes_user ON voice_notes (user_id);
CREATE INDEX idx_voice_notes_status ON voice_notes (status);
CREATE INDEX idx_voice_notes_recorded ON voice_notes (recorded_at DESC);

CREATE TRIGGER trg_voice_notes_updated_at
  BEFORE UPDATE ON voice_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- OPPORTUNITIES
-- =============================================================================

CREATE TABLE opportunities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number        TEXT,
  title         TEXT NOT NULL,
  status        opportunity_status NOT NULL DEFAULT 'draft',
  total_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  valid_until   DATE,
  sent_at       TIMESTAMPTZ,
  accepted_at   TIMESTAMPTZ,
  notes         TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT opportunities_number_unique UNIQUE (number)
);

CREATE INDEX idx_opportunities_company ON opportunities (company_id);
CREATE INDEX idx_opportunities_user ON opportunities (user_id);
CREATE INDEX idx_opportunities_status ON opportunities (status);
CREATE INDEX idx_opportunities_valid_until ON opportunities (valid_until);

CREATE TRIGGER trg_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- PRODUCTS
-- =============================================================================

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           TEXT,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  unit_price    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT products_sku_unique UNIQUE (sku)
);

CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_active ON products (is_active) WHERE is_active = true;
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- COMPANY_PRODUCTS
-- =============================================================================

CREATE TABLE company_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_price      NUMERIC(14, 2),
  discount_percent  NUMERIC(5, 2),
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT company_products_unique UNIQUE (company_id, product_id)
);

CREATE INDEX idx_company_products_company ON company_products (company_id);
CREATE INDEX idx_company_products_product ON company_products (product_id);

CREATE TRIGGER trg_company_products_updated_at
  BEFORE UPDATE ON company_products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ATTACHMENTS
-- =============================================================================

CREATE TABLE attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   attachment_entity_type NOT NULL,
  entity_id     UUID NOT NULL,
  file_name     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  mime_type     TEXT,
  file_size     BIGINT,
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_entity ON attachments (entity_type, entity_id);
CREATE INDEX idx_attachments_uploaded_by ON attachments (uploaded_by);

CREATE TRIGGER trg_attachments_updated_at
  BEFORE UPDATE ON attachments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Le RLS policy e i GRANT per il ruolo `authenticated` (modello single-tenant)
-- sono definiti in `supabase/policies.sql`. Applicali dopo questo schema:
-- Supabase Dashboard → SQL Editor → incolla policies.sql → Run.

-- =============================================================================
-- Commenti
-- =============================================================================

COMMENT ON TABLE companies IS 'Aziende CRM — import Excel fino a 76 colonne via excel_col_001..076 + import_payload JSONB';
COMMENT ON COLUMN companies.import_payload IS 'Payload JSONB: { "header_originale": "valore" } per ogni colonna Excel';
COMMENT ON COLUMN companies.import_headers IS 'Intestazioni Excel originali ordinate (max 76)';
COMMENT ON COLUMN companies.excel_col_001 IS 'Slot posizionale colonna Excel 1/76';
