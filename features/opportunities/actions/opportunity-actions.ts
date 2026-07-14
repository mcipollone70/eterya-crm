"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isOpportunityStage, type OpportunityStage } from "@/lib/constants/opportunity-pipeline";
import { isProductFamily } from "@/lib/constants/product-catalog";
import {
  saveOpportunity,
  updateOpportunityStage,
  type SaveOpportunityInput,
} from "../services/opportunities.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function saveOpportunityAction(
  input: SaveOpportunityInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId.trim() || !input.title.trim()) {
    return { success: false, message: "Azienda e titolo sono obbligatori." };
  }

  if (!isProductFamily(input.productFamily)) {
    return { success: false, message: "Famiglia prodotto obbligatoria." };
  }

  const { opportunityId, error } = await saveOpportunity(input);
  if (error || !opportunityId) {
    return { success: false, message: error ?? "Salvataggio opportunità non riuscito." };
  }

  revalidatePath("/opportunities");
  revalidatePath("/");
  revalidatePath(`/companies/${input.companyId}`);
  revalidatePath("/companies");

  return { success: true, message: "Opportunità creata." };
}

export async function updateOpportunityStageAction(
  opportunityId: string,
  companyId: string,
  stage: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!isOpportunityStage(stage)) {
    return { success: false, message: "Fase non valida." };
  }

  const result = await updateOpportunityStage(opportunityId, stage as OpportunityStage);
  if (result.success) {
    revalidatePath("/opportunities");
    revalidatePath("/");
    revalidatePath(`/companies/${companyId}`);
    revalidatePath("/companies");
    revalidatePath("/activities");
  }

  return result;
}
