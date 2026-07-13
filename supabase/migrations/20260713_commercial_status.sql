-- Migration idempotente: stato commerciale aziende
-- Esegui in Supabase Dashboard → SQL Editor

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
  ADD COLUMN IF NOT EXISTS commercial_status commercial_status NOT NULL DEFAULT 'prospect';

CREATE INDEX IF NOT EXISTS idx_companies_commercial_status
  ON companies (commercial_status);

COMMENT ON COLUMN companies.commercial_status IS
  'Stato commerciale (Prospect, Cliente, Ex Cliente, Da ricontattare, Non interessato) — distinto da status (company_status)';
