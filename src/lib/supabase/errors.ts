import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traduce un errore Postgrest in un messaggio utente.
 *
 * Il caso "permission denied" (SQLSTATE 42501) indica che i GRANT o le policy
 * RLS per il ruolo `authenticated` non sono ancora stati applicati: rimanda a
 * `supabase/policies.sql`. Un elenco vuoto senza errore, invece, è uno stato
 * legittimo (RLS attiva ma nessuna riga) e va gestito a monte dai chiamanti.
 */
export function describeDbError(error: PostgrestError | null): string | null {
  if (!error) {
    return null;
  }

  if (
    error.code === "42501" ||
    /permission denied|row-level security/i.test(error.message)
  ) {
    return "Accesso al database negato dalle policy di sicurezza. Esegui supabase/policies.sql nel SQL editor di Supabase per abilitare il ruolo authenticated.";
  }

  if (
    /commercial_status/i.test(error.message) &&
    /does not exist|column/i.test(error.message)
  ) {
    return "La colonna commercial_status non esiste ancora nel database. Esegui supabase/migrations/20260713_commercial_status_backfill.sql nel SQL Editor di Supabase.";
  }

  return error.message;
}
