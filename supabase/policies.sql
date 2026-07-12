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

-- -----------------------------------------------------------------------------
-- 5) Verifica (opzionale): dovrebbe elencare `authenticated` con i 4 privilegi.
-- -----------------------------------------------------------------------------
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'companies'
-- order by grantee, privilege_type;
