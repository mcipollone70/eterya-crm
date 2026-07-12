import "server-only";

import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Restituisce l'utente autenticato, oppure `null`.
 * Non lancia mai: se Supabase non è configurato o la sessione è assente,
 * la UI degrada senza errori. Memoizzato per render pass con `cache`.
 */
export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});
