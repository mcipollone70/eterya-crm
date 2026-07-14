-- Migration idempotente: campi e stati geocoding Geoapify
-- Esegui in Supabase Dashboard → SQL Editor

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
