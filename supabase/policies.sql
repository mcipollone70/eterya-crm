-- =============================================================================
-- Eterya CRM — Row Level Security & Privileges (single-tenant)
-- =============================================================================
-- Modello SINGLE-TENANT: qualunque utente autenticato può leggere e scrivere
-- TUTTE le righe. Lo schema non ha `org_id` e questo file NON introduce
-- multi-tenancy (decisione futura separata).
--
-- Il data layer usa il client server auth-scoped (`@supabase/ssr`), quindi le
-- query girano come ruolo `authenticated`: senza questi GRANT + policy il ruolo
-- non ha privilegi e ogni query fallisce con "permission denied" (SQLSTATE
-- 42501). Al ruolo `anon` NON viene concesso nulla.
--
-- Prerequisito: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` è già in schema.sql.
-- Idempotente: sicuro da rieseguire.
--
-- Come applicarlo: Supabase Dashboard → SQL Editor → NUOVA query → incolla
-- TUTTO questo file (senza selezionare solo una parte) → Run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Accesso allo schema.
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Privilegi DML su TUTTE le tabelle esistenti dello schema public.
--    Usiamo "ALL TABLES IN SCHEMA" per evitare errori di elenco tabelle: se una
--    sola tabella non esistesse, un GRANT con lista fallirebbe per intero.
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Le PK sono UUID (gen_random_uuid()); in genere non servono sequence. Le
-- concediamo comunque per robustezza, nel caso esistano colonne serial/identity.
grant usage, select on all sequences in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Privilegi di DEFAULT: le tabelle/sequence CREATE IN FUTURO da questo ruolo
--    erediteranno automaticamente i permessi per `authenticated`.
--    (Non retroattivo: per le tabelle già esistenti valgono i GRANT sopra.)
-- -----------------------------------------------------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Policy RLS: accesso completo per il ruolo authenticated (USING/WITH CHECK true).
--    Una policy FOR ALL per tabella copre SELECT/INSERT/UPDATE/DELETE.
-- -----------------------------------------------------------------------------
drop policy if exists "authenticated_all_users" on users;
create policy "authenticated_all_users" on users
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_companies" on companies;
create policy "authenticated_all_companies" on companies
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_contacts" on contacts;
create policy "authenticated_all_contacts" on contacts
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_activities" on activities;
create policy "authenticated_all_activities" on activities
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_visits" on visits;
create policy "authenticated_all_visits" on visits
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_voice_notes" on voice_notes;
create policy "authenticated_all_voice_notes" on voice_notes
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_opportunities" on opportunities;
create policy "authenticated_all_opportunities" on opportunities
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_products" on products;
create policy "authenticated_all_products" on products
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_company_products" on company_products;
create policy "authenticated_all_company_products" on company_products
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_attachments" on attachments;
create policy "authenticated_all_attachments" on attachments
  for all to authenticated using (true) with check (true);

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
-- 6) Re-applica GRANT su tutte le tabelle (incluse quelle create dalle migrazioni).
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- -----------------------------------------------------------------------------
-- 7) Verifica (opzionale): dovrebbe elencare `authenticated` con i 4 privilegi.
-- -----------------------------------------------------------------------------
