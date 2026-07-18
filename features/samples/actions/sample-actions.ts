"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateDashboardPaths } from "@/lib/revalidate/dashboard-paths";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSampleStatus } from "@/lib/constants/samples";
import {
  deleteSample,
  saveSample,
  updateSample,
  type SaveSampleInput,
  type UpdateSampleInput,
} from "../services/samples.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

function revalidateSamplePaths(sampleId: string, companyId: string) {
  revalidatePath("/campioni");
  revalidatePath(`/campioni/${sampleId}`);
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
  revalidatePath("/activities");
  revalidateDashboardPaths();
}

export async function saveSampleAction(
  input: SaveSampleInput
): Promise<{ success: boolean; message: string; sampleId?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId.trim() || !input.title.trim()) {
    return { success: false, message: "Azienda e descrizione campione sono obbligatori." };
  }

  if (input.status && !isSampleStatus(input.status)) {
    return { success: false, message: "Stato campione non valido." };
  }

  const { sampleId, error } = await saveSample(input);
  if (error || !sampleId) {
    return { success: false, message: error ?? "Salvataggio campione non riuscito." };
  }

  revalidateSamplePaths(sampleId, input.companyId);
  return { success: true, message: "Campione registrato.", sampleId };
}

export async function updateSampleAction(
  sampleId: string,
  input: UpdateSampleInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId.trim() || !input.title.trim()) {
    return { success: false, message: "Azienda e descrizione campione sono obbligatori." };
  }

  if (input.status && !isSampleStatus(input.status)) {
    return { success: false, message: "Stato campione non valido." };
  }

  const { error } = await updateSample(sampleId, input);
  if (error) {
    return { success: false, message: error };
  }

  revalidateSamplePaths(sampleId, input.companyId);
  redirect(`/campioni/${sampleId}`);
}

export async function deleteSampleAction(
  sampleId: string,
  companyId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const { error } = await deleteSample(sampleId);
  if (error) {
    return { error };
  }

  revalidateSamplePaths(sampleId, companyId);
  redirect("/campioni");
}
