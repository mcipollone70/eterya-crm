import { createServerClient as createSsrServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { requireSupabasePublicEnv } from "./env";

/**
 * Client Supabase lato server (RSC, Server Action, Route Handler).
 * Legge e aggiorna la sessione tramite i cookie della richiesta con `@supabase/ssr`.
 *
 * In Next.js 16 `cookies()` è asincrono: questa funzione va sempre attesa.
 */
export async function createServerClient() {
  const { url, anonKey } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createSsrServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // `setAll` invocato da un Server Component: i cookie sono di sola
          // lettura. Il refresh della sessione avviene comunque nel proxy.
        }
      },
    },
  });
}
