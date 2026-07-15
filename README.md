# Eterya CRM — Release 1.0

**Stato:** Release 1.0 — single-tenant CRM commerciale per agenti e amministratori.

## Moduli inclusi (certificati)

| Modulo | Route principale |
|--------|------------------|
| Login / autenticazione | `/login` |
| Gestione utenti e permessi | `/admin/users` |
| Aziende | `/companies` |
| Contatti (referenti) | `/contacts` |
| Opportunità | `/opportunities` |
| Agenda | `/agenda` |
| Visite | `/visits` |
| Giri visite (Visit Tours) | `/routes` |
| Modalità auto | `/auto` |
| Mappe / geolocalizzazione | `/maps` |
| Dashboard (Mission Control) | `/` |
| Command Center | `/command-center` |
| Joy AI | `/joy`, `/joy/chat`, `/joy/autonomous` |
| Report | `/reports` |
| Impostazioni (Google Calendar) | `/settings` |

Moduli aggiuntivi presenti ma fuori scope certificazione 1.0: `/activities`, `/products`, `/assistant`, `/voice`.

## Requisiti

- Node.js 20+
- Progetto Supabase (PostgreSQL 15+ con PostGIS)
- Account Geoapify (geocodifica)
- Progetto Google Cloud (OAuth Calendar, opzionale)

## Setup locale

1. Clona il repository e installa le dipendenze:

```bash
npm install
```

2. Copia le variabili ambiente:

```bash
copy .env.example .env.local
```

3. Compila `.env.local` con i valori del tuo ambiente (vedi sezione sotto).

4. Applica lo schema e le migration Supabase (vedi [Database](#database-supabase)).

5. Avvia il server di sviluppo:

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

### Build di produzione

```bash
npm run build
npm run start
```

## Variabili ambiente

**Non committare `.env.local`.** Nomi variabili richiesti/opzionali:

| Variabile | Scope | Descrizione |
|-----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | URL progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Chiave anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | solo server | Service role (admin utenti, bypass RLS) |
| `SUPABASE_SECRET_KEY` | solo server | Alias alternativo service role |
| `NEXT_PUBLIC_APP_URL` | client + server | URL base app (OAuth, link calendario) |
| `GEOAPIFY_API_KEY` | solo server | Geocodifica indirizzi |
| `GOOGLE_CLIENT_ID` | solo server | OAuth Google Calendar |
| `GOOGLE_CLIENT_SECRET` | solo server | OAuth Google Calendar |
| `GOOGLE_OAUTH_REDIRECT_URI` | solo server | Callback OAuth (es. `{APP_URL}/api/google/calendar/callback`) |
| `SIGNUP_INVITE_SECRET` | solo server | Codice invito registrazione (produzione) |
| `ALLOW_PUBLIC_SIGNUP` | solo server | `"true"` per abilitare signup in produzione |
| `NODE_ENV` | runtime | `development` / `production` |

Vedi `.env.example` per un template minimo.

## Database (Supabase)

### Ordine di applicazione

1. **`supabase/schema.sql`** — schema base, enum, tabelle, indici, RLS abilitato.
2. **Migration** (SQL Editor, in ordine cronologico):

```
supabase/migrations/20260713_commercial_status.sql
supabase/migrations/20260713_commercial_status_backfill.sql
supabase/migrations/20260713_geocoding_geoapify.sql
supabase/migrations/20260713_contact_history.sql
supabase/migrations/20260713_geocoding_normalized_address.sql
supabase/migrations/20260713_commercial_dashboard.sql
supabase/migrations/20260713_visit_tours.sql
supabase/migrations/20260713_opportunity_pipeline.sql
supabase/migrations/20260713_follow_ups.sql
supabase/migrations/20260713_products_interests.sql
supabase/migrations/20260713_last_visit.sql
supabase/migrations/20260714_database_stack_enums.sql
supabase/migrations/20260714_database_stack_apply.sql
supabase/migrations/20260714_data_performance.sql
supabase/migrations/20260714_field_ops_workflow.sql
supabase/migrations/20260714_agenda_reminders.sql
supabase/migrations/20260714_google_calendar_integration.sql
supabase/migrations/20260715_google_calendar_sync_visibility.sql
```

3. **`supabase/policies.sql`** — GRANT e policy RLS per ruolo `authenticated`.

### Migration opzionale

- **`supabase/migrations/20260715_visit_tours_name.sql`** — colonna `visit_tours.name` per rinominare i giri salvati. Senza di essa l'app funziona con fallback; compare un messaggio esplicito se la colonna manca.

## Ruoli e accesso

| Ruolo | Accesso |
|-------|---------|
| `agent` | Moduli operativi (default alla registrazione) |
| `viewer` | Sola lettura (assegnabile da admin) |
| `org_admin` | Tutti i moduli + `/admin/users` |
| `super_admin` | Come `org_admin` |
| `manager` | Ruolo schema DB; permessi UI allineati ad agent salvo personalizzazioni future |

### Promuovere il primo amministratore

Dopo la registrazione del primo utente, esegui nel SQL Editor Supabase:

```sql
UPDATE users
SET role = 'org_admin'
WHERE email = 'tuo-email@dominio.it';
```

Il modulo **Admin utenti** (`/admin/users`) richiede `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` per creare utenti e gestire accessi.

## Configurazioni esterne

- **Supabase Auth:** email/password; redirect callback su `/auth/callback`.
- **Email invito:** in produzione disabilitare signup pubblico; usare `SIGNUP_INVITE_SECRET` o creazione utenti via admin.
- **Google Calendar:** OAuth in Google Cloud Console; redirect URI = `GOOGLE_OAUTH_REDIRECT_URI`; connessione da `/settings`.
- **Geoapify:** chiave server-side per import/geocodifica aziende e percorsi.

## Script di sviluppo

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Server di sviluppo |
| `npm run build` | Build produzione |
| `npm run start` | Avvia build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Verifica TypeScript |

## Release 1.0

Checklist tecnica completa: [`RELEASE_1_0_CHECKLIST.md`](./RELEASE_1_0_CHECKLIST.md).
