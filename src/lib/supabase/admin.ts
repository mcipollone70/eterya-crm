import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getSupabasePublicEnv, requireSupabasePublicEnv } from "./env";

/**
 * Client Supabase con service role — SOLO server-side, SOLO azioni admin
 * dopo verifica del ruolo dell'utente chiamante.
 * Non importare mai da componenti client.
 */
function resolveServiceRoleKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim()
  );
}

export function createAdminClient() {
  const serviceRoleKey = resolveServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY non configurata. Aggiungila in .env.local (solo server)."
    );
  }

  const { url } = requireSupabasePublicEnv();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** `true` se URL pubblico e service role sono entrambi configurati. */
export function isAdminClientConfigured(): boolean {
  return Boolean(getSupabasePublicEnv() && resolveServiceRoleKey());
}
