import type { PostgrestError } from "@supabase/supabase-js";

/** `true` se PostgREST ha rifiutato la query per GRANT mancanti a `service_role`. */
export function isServiceRoleGrantError(error: PostgrestError): boolean {
  return error.code === "42501" && /service_role/i.test(error.hint ?? "");
}

/** `true` se la richiesta è anonima (sessione assente) per GRANT mancanti a `anon`. */
export function isAnonGrantError(error: PostgrestError): boolean {
  return error.code === "42501" && /\banon\b/i.test(error.hint ?? "");
}

/**
 * Traduce un errore Postgrest in un messaggio utente.
 *
 * SQLSTATE 42501 copre sia GRANT mancanti (hint "GRANT ... TO role") sia
 * violazioni RLS reali (messaggio "row-level security policy"). Non confondere
 * i due casi: il primo è configurazione API/privilegi, il secondo è policy RLS.
 */
export function describeDbError(error: PostgrestError | null): string | null {
  if (!error) {
    return null;
  }

  if (error.code === "42501") {
    if (/row-level security policy/i.test(error.message)) {
      return "Accesso al database negato dalle policy di sicurezza. Esegui supabase/policies.sql nel SQL editor di Supabase per abilitare il ruolo authenticated.";
    }

    if (isServiceRoleGrantError(error)) {
      return "Privilegi API mancanti per service_role sulla tabella. Concedi SELECT/INSERT/UPDATE/DELETE a service_role oppure usa il client autenticato.";
    }

    if (isAnonGrantError(error)) {
      return "Sessione non autenticata o privilegi anon mancanti. Accedi di nuovo al CRM.";
    }

    if (/authenticated/i.test(error.hint ?? "")) {
      return "Privilegi authenticated mancanti. Esegui supabase/policies.sql nel SQL editor di Supabase.";
    }

    return error.message || "Permesso database negato (42501).";
  }

  if (
    /commercial_status/i.test(error.message) &&
    /does not exist|column/i.test(error.message)
  ) {
    return "La colonna commercial_status non esiste ancora nel database. Esegui supabase/migrations/20260713_commercial_status_backfill.sql nel SQL Editor di Supabase.";
  }

  if (/visit_tours\.name/i.test(error.message) && /does not exist|column/i.test(error.message)) {
    return "La colonna visit_tours.name non esiste ancora nel database. Esegui supabase/migrations/20260715_visit_tours_name.sql nel SQL Editor di Supabase.";
  }

  return error.message;
}
