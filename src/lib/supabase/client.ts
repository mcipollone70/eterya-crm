import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { requireSupabasePublicEnv } from "./env";

/** Client Supabase per i Client Component (browser), con gestione sessione via cookie. */
export function createBrowserClient() {
  const { url, anonKey } = requireSupabasePublicEnv();
  return createSsrBrowserClient<Database>(url, anonKey);
}
