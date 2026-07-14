"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isOpportunityStage, type OpportunityStage } from "@/lib/constants/opportunity-pipeline";
import { isProductFamily } from "@/lib/constants/product-catalog";
import {
  deleteOpportunity,
  saveOpportunity,
  updateOpportunity,
  updateOpportunityStage,
  type SaveOpportunityInput,
  type UpdateOpportunityInput,
} from "../services/opportunities.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

function revalidateOpportunityPaths(opportunityId: string, companyId: string) {
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/");
  revalidatePath("/command-center");
  revalidatePath("/reports");
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
  revalidatePath("/activities");
}

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

  revalidateOpportunityPaths(opportunityId, input.companyId);

  return { success: true, message: "Opportunità creata." };
}

export async function updateOpportunityAction(
  opportunityId: string,
  input: UpdateOpportunityInput
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

  if (input.stage && !isOpportunityStage(input.stage)) {
    return { success: false, message: "Fase non valida." };
  }

  const { error } = await updateOpportunity(opportunityId, input);
  if (error) {
    return { success: false, message: error };
  }

  revalidateOpportunityPaths(opportunityId, input.companyId);
  redirect(`/opportunities/${opportunityId}`);
}

export async function deleteOpportunityAction(
  opportunityId: string,
  companyId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const { error } = await deleteOpportunity(opportunityId);
  if (error) {
    return { error };
  }

  revalidateOpportunityPaths(opportunityId, companyId);
  redirect("/opportunities");
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
    revalidateOpportunityPaths(opportunityId, companyId);
  }

  return result;
}

export async function closeOpportunityAction(
  opportunityId: string,
  companyId: string,
  stage: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (stage !== "won" && stage !== "lost") {
    return { success: false, message: "Seleziona Vinta o Persa per chiudere l'opportunità." };
  }

  return updateOpportunityStageAction(opportunityId, companyId, stage);
}
