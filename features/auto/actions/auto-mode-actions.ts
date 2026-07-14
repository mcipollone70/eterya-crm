"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { syncVisitCalendar } from "@/features/calendar-sync/sync-hooks";
import { updateScheduledVisit } from "@/features/visits/services/visits.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

function revalidateAutoPaths(companyId: string) {
  revalidatePath("/auto");
  revalidatePath("/visits");
  revalidatePath("/agenda");
  revalidatePath("/");
  revalidatePath(`/companies/${companyId}`);
}

export async function updateVisitNotesAction(
  visitId: string,
  companyId: string,
  notes: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const { error } = await updateScheduledVisit(visitId, {
    notes: notes.trim() || null,
  });

  if (error) {
    return { success: false, message: error };
  }

  revalidateAutoPaths(companyId);
  await syncVisitCalendar(visitId, "upsert");

  return { success: true, message: "Note visita salvate." };
}
