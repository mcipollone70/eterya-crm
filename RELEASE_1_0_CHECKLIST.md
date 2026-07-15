# Eterya CRM â€” Release 1.0 Checklist

**Data verifica:** 2026-07-15  
**Branch:** `main` (working tree clean)  
**Versione package:** `1.0.0`

---

## 1. Moduli certificati (Release 1.0)

- [x] Login / autenticazione
- [x] User management / permessi
- [x] Companies (Aziende)
- [x] Contacts (Contatti / referenti)
- [x] Opportunities (OpportunitÃ )
- [x] Agenda
- [x] Visits (Visite)
- [x] Visit Tours (Giri visite â€” `/routes`)
- [x] Maps / Geolocalizzazione
- [x] Google Maps (Leaflet)
- [x] Google Calendar sync
- [x] Dashboard / Mission Control (`/`)
- [x] Joy AI / Command Center (`/joy`, `/command-center`)
- [x] Admin users (`/admin/users`)
- [x] Agent permissions (RLS single-tenant, ruoli)

**Fuori scope 1.0 (presenti ma non certificati):** `/activities`, `/products`, `/assistant`, `/voice`.

---

## 2. Test eseguiti

| Test | Risultato | Note |
|------|-----------|------|
| `git status` | âœ… PASS | Working tree clean |
| `.gitignore` | âœ… PASS | `.next`, `node_modules`, `.env*` ignorati |
| Secrets scan (tracked files) | âœ… PASS | Nessun secret hardcoded nei file tracciati |
| `.env.local` gitignored | âœ… PASS | Non tracciato da git |
| `npx tsc --noEmit` | âœ… PASS | Exit code 0 |
| `npm run build` | âœ… PASS | Compilazione e TypeScript OK |
| Route check (build output) | âœ… PASS | Vedi sezione 3 |

---

## 3. Route verificate (build Next.js)

| Route richiesta | Presente |
|-----------------|----------|
| `/` | âœ… |
| `/login` | âœ… |
| `/companies` | âœ… |
| `/contacts` | âœ… |
| `/opportunities` | âœ… |
| `/agenda` | âœ… |
| `/visits` | âœ… |
| `/auto` | âœ… |
| `/routes` | âœ… (Visit Tours) |
| `/maps` | âœ… |
| `/command-center` | âœ… |
| `/joy` | âœ… (+ `/joy/chat`, `/joy/autonomous`) |
| `/admin/users` | âœ… |
| `/reports` | âœ… |
| `/settings` | âœ… (Google Calendar) |
| `/auth/callback` | âœ… |
| `/api/google/calendar/*` | âœ… |

---

## 4. Migration da applicare

**Prerequisito:** `supabase/schema.sql`

**Migration obbligatorie** (ordine cronologico):

1. `supabase/migrations/20260713_commercial_status.sql`
2. `supabase/migrations/20260713_commercial_status_backfill.sql`
3. `supabase/migrations/20260713_geocoding_geoapify.sql`
4. `supabase/migrations/20260713_contact_history.sql`
5. `supabase/migrations/20260713_geocoding_normalized_address.sql`
6. `supabase/migrations/20260713_commercial_dashboard.sql`
7. `supabase/migrations/20260713_visit_tours.sql`
8. `supabase/migrations/20260713_opportunity_pipeline.sql`
9. `supabase/migrations/20260713_follow_ups.sql`
10. `supabase/migrations/20260713_products_interests.sql`
11. `supabase/migrations/20260713_last_visit.sql`
12. `supabase/migrations/20260714_database_stack_enums.sql`
13. `supabase/migrations/20260714_database_stack_apply.sql`
14. `supabase/migrations/20260714_data_performance.sql`
15. `supabase/migrations/20260714_field_ops_workflow.sql`
16. `supabase/migrations/20260714_agenda_reminders.sql`
17. `supabase/migrations/20260714_google_calendar_integration.sql`
18. `supabase/migrations/20260715_google_calendar_sync_visibility.sql`

**Post-migration:** `supabase/policies.sql` (GRANT + RLS per `authenticated`)

**Opzionale (non bloccante):**

- `supabase/migrations/20260715_visit_tours_name.sql` â€” nome visualizzato giri visite

---

## 5. Configurazioni esterne

### Supabase

- [ ] Progetto creato con PostGIS abilitato
- [ ] Auth email/password configurata
- [ ] Site URL e redirect URLs (`/auth/callback`)
- [ ] `schema.sql` + migration + `policies.sql` applicati
- [ ] Primo utente promosso a `org_admin` (SQL manuale)

### Variabili ambiente produzione

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (server only, per admin utenti)
- [ ] `NEXT_PUBLIC_APP_URL` (URL produzione)
- [ ] `GEOAPIFY_API_KEY`
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` (se Calendar sync attivo)
- [ ] `SIGNUP_INVITE_SECRET` o `ALLOW_PUBLIC_SIGNUP` (politica registrazione)

### Google Cloud (Calendar)

- [ ] OAuth consent screen
- [ ] Client OAuth con redirect `{APP_URL}/api/google/calendar/callback`
- [ ] Scope Calendar events

### Email / inviti

- [ ] Signup disabilitato in produzione (default) oppure invito controllato
- [ ] Template email Supabase (reset password, conferma)

---

## 6. Limiti noti (non bloccanti)

| Area | Limite | Impatto |
|------|--------|---------|
| **Contatti** | Referenti derivati da campi azienda (`contact_name`, payload Excel) appaiono in lista come voci sintetiche (`fromCompanyReferent`) se non esiste riga in `contacts` | Visualizzazione unificata; modifica solo tramite scheda azienda o creazione contatto dedicato |
| **Mappe** | Max 1500 aziende per area viewport (`MAP_MAX_FETCH_PER_BOUNDS`); paginazione 500/1000 | Zone molto dense: marker parziali; suddivisione automatica bounds |
| **Visit Tours** | Migration `visit_tours.name` opzionale | Senza colonna: nomi default; messaggio errore esplicito se feature rename usata |
| **Single-tenant** | RLS: tutti gli `authenticated` vedono tutti i dati | Nessun isolamento multi-org (by design 1.0) |
| **Admin utenti** | Richiede `SUPABASE_SERVICE_ROLE_KEY` + GRANT su tabelle | Fallback client autenticato se GRANT mancanti (42501) |
| **Geocodifica** | Richiede `GEOAPIFY_API_KEY` | Import/geocode degradati senza chiave |
| **Google Calendar** | OAuth opzionale | Modulo settings mostra istruzioni se non configurato |
| **Probe scripts** | 9 file `scripts/probe-*.mjs` tracciati in repo | Solo debug locale; non usati in produzione |

---

## 7. Production deploy checklist

- [ ] `npm run build` su CI o macchina deploy
- [ ] Env vars impostate su hosting (Vercel / altro)
- [ ] `NEXT_PUBLIC_APP_URL` = dominio produzione
- [ ] Supabase migration allineate all'ambiente prod
- [ ] `policies.sql` applicato
- [ ] Primo admin creato e testato login
- [ ] Test smoke: login â†’ dashboard â†’ companies â†’ contacts â†’ visits â†’ maps
- [ ] Test admin: `/admin/users` con service role
- [ ] (Opzionale) Google Calendar connect da `/settings`
- [ ] Tag git `v1.0.0` dopo deploy verificato

---

## 8. Working tree & artefatti

| Item | Stato |
|------|-------|
| Working tree | Clean |
| `.next/` | Gitignored (artefatti build locali) |
| `.env.local` | Gitignored, presente solo in locale |
| `scripts/probe-*.mjs` | Tracciati (debug); nessuna rimozione necessaria per release |
| Temp files `.tmp-*` | Nessuno presente |

---

## 9. Giudizio finale Release 1.0

### âœ… PRONTA

**Motivazione:**

- TypeScript e build produzione passano senza errori
- Tutte le route principali certificate sono presenti nel build
- Nessun secret tracciato in git; `.env.local` correttamente ignorato
- Working tree pulito
- Documentazione release (`README.md`, questa checklist) aggiornata
- Migration e configurazioni esterne documentate

**Note pre-tag:**

- `package.json` / `package-lock.json` impostati su `1.0.0` (commit release prima del tag)
- Verificare migration su ambiente Supabase di produzione prima del deploy
- Considerare rimozione post-release degli script `scripts/probe-*.mjs` in un commit dedicato (non bloccante)

