import type { ManualAdminTopic } from "../types";

export const MANUAL_ADMIN_TOPICS: ManualAdminTopic[] = [
  {
    id: "gestione-utenti",
    title: "Gestione utenti",
    description:
      "Dalla voce Amministrazione (/admin/users) l'Amministratore consulta l'elenco utenti con email, ruolo e stato attivo/disattivo.",
    steps: [
      "Accedi con un account org_admin o super_admin.",
      "Dal menu inferiore seleziona Amministrazione.",
      "Consulta l'elenco utenti e usa i filtri disponibili.",
      "Clicca su una riga per modificare un utente esistente.",
    ],
    technicalNote: null,
  },
  {
    id: "creazione-utente",
    title: "Creazione nuovo utente",
    description:
      "Per ogni nuovo account l'Amministratore può scegliere tra password provvisoria o invito via email con link di attivazione Supabase Auth.",
    steps: [
      "Clicca Nuovo utente in Amministrazione.",
      "Inserisci email, nome e ruolo (Agente, Amministratore o Sola lettura).",
      "Scegli Password provvisoria oppure Invia invito via email.",
      "Conferma l'operazione e verifica lo stato dell'invito o della creazione.",
    ],
    technicalNote: null,
  },
  {
    id: "disattivazione-account",
    title: "Disattivazione account",
    description:
      "Un account disattivato non può più accedere al CRM ma lo storico associato resta disponibile.",
    steps: [
      "Apri la scheda modifica dell'utente in Amministrazione.",
      "Imposta lo stato su disattivo e salva.",
      "Comunica all'Utente che l'accesso è stato revocato.",
    ],
    technicalNote: null,
  },
  {
    id: "config-supabase",
    title: "Configurazione Supabase",
    description:
      "Il CRM richiede le variabili d'ambiente Supabase per autenticazione e database. Senza di esse compare «Database non configurato».",
    steps: [
      "Imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
      "Per le operazioni amministrative imposta SUPABASE_SERVICE_ROLE_KEY solo lato server.",
      "Riavvia il server di sviluppo o il deploy dopo ogni modifica.",
    ],
    technicalNote: "Operazione tecnica riservata all'amministratore.",
  },
  {
    id: "config-geoapify",
    title: "Geocoding Geoapify",
    description:
      "Il geocoding automatico delle aziende richiede una chiave API Geoapify configurata dall'Amministratore.",
    steps: [
      "Ottieni una chiave API Geoapify.",
      "Imposta GEOAPIFY_API_KEY nelle variabili d'ambiente del server.",
      "Riavvia l'applicazione e verifica il pannello Geolocalizzazione in Aziende.",
    ],
    technicalNote: "Operazione tecnica riservata all'amministratore.",
  },
  {
    id: "config-google",
    title: "Integrazione Google Calendar",
    description:
      "La sincronizzazione calendario richiede credenziali OAuth Google configurate lato server. Gli Utenti collegano il proprio account da Impostazioni. Il CRM resta operativo anche senza Calendar collegato.",
    steps: [
      "Imposta GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (solo server).",
      "Imposta GOOGLE_OAUTH_REDIRECT_URI uguale a un URI autorizzato in Google Cloud Console.",
      "Redirect locale tipico: http://localhost:3000/api/google/calendar/callback (o altra porta se registrata).",
      "Redirect produzione: https://eterya-crm.vercel.app/api/google/calendar/callback (e futuro dominio custom).",
      "Applica la migrazione additiva 20260716_google_calendar_bidirectional.sql su Supabase (eventi Google in Agenda).",
      "Gli Utenti collegano/ricollegano da Impostazioni (/settings) e usano «Sincronizza ora».",
    ],
    technicalNote:
      "Scope richiesti: openid, email, https://www.googleapis.com/auth/calendar.events. Access type offline + consent. Token solo lato server.",
  },
];
