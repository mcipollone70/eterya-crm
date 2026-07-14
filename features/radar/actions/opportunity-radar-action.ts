"use server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { analyzeOpportunityRadar } from "../services/opportunity-radar.service";
import type {
  OpportunityRadarAnalyzeInput,
  OpportunityRadarAnalyzeResult,
} from "../types";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function analyzeOpportunityRadarAction(
  input: OpportunityRadarAnalyzeInput
): Promise<OpportunityRadarAnalyzeResult> {
  if (!isSupabaseConfigured()) {
    return { items: [], error: NOT_CONFIGURED_MESSAGE };
  }

  try {
    return await analyzeOpportunityRadar(input);
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : "Analisi radar non riuscita.",
    };
  }
}
