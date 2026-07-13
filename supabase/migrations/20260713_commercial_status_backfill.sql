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
