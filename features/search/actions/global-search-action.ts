"use server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { globalSearchSafe } from "../services/global-search.service";
import type { GlobalSearchResponse } from "../types";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function globalSearchAction(query: string): Promise<GlobalSearchResponse> {
  if (!isSupabaseConfigured()) {
    return { groups: [], total: 0, error: NOT_CONFIGURED_MESSAGE };
  }

  return globalSearchSafe(query);
}
