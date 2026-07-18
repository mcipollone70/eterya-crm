"use server";

import { revalidatePath } from "next/cache";
import { revalidateDashboardPaths } from "@/lib/revalidate/dashboard-paths";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateCompanyById } from "../services/companies.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function updateCompanyNotesAction(
  companyId: string,
  input: { notes: string | null; internalNotes: string | null }
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const { error } = await updateCompanyById(companyId, {
    notes: input.notes,
    internal_notes: input.internalNotes,
  });

  if (error) {
    return { success: false, message: error };
  }

  revalidatePath(`/companies/${companyId}`);
  revalidateDashboardPaths();

  return { success: true, message: "Note salvate correttamente." };
}
