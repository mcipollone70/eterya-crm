-- Migration idempotente: indirizzo normalizzato da Geoapify
-- Esegui in Supabase Dashboard → SQL Editor

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS geocoding_normalized_address TEXT;

COMMENT ON COLUMN companies.geocoding_normalized_address IS
  'Indirizzo formattato restituito dal provider di geocodifica';
