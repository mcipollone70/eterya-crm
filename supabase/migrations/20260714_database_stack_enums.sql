-- =============================================================================
-- Eterya CRM — Database Stack PART 1: estensioni ENUM
-- =============================================================================
-- Esegui PRIMA di 20260714_database_stack_apply.sql
--
-- PostgreSQL non consente di usare un nuovo valore enum nella stessa
-- transazione in cui viene aggiunto (SQLSTATE 55P04). Questo file contiene
-- SOLO le estensioni di tipi enum esistenti; lo stack apply usa i nuovi valori.
--
-- Prerequisito: supabase/schema.sql già applicato.
-- Idempotente: ADD VALUE IF NOT EXISTS + controlli pg_enum per geocode_status.
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_schema_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_schema_migrations (name)
VALUES ('20260714_database_stack_enums')
ON CONFLICT (name) DO NOTHING;

-- activity_type (schema base: call, email, task, follow_up, meeting)
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'visit';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'quote';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'note';

-- geocode_status (schema base: not_geocoded, geocoded, pending, failed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'geocode_status' AND e.enumlabel = 'processing'
  ) THEN
    ALTER TYPE geocode_status ADD VALUE 'processing';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'geocode_status' AND e.enumlabel = 'completed'
  ) THEN
    ALTER TYPE geocode_status ADD VALUE 'completed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'geocode_status' AND e.enumlabel = 'needs_review'
  ) THEN
    ALTER TYPE geocode_status ADD VALUE 'needs_review';
  END IF;
END $$;
