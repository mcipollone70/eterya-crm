"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  completeScheduledVisit,
  saveCompletedVisit,
  scheduleVisit,
  type CompleteScheduledVisitInput,
  type SaveVisitInput,
  type ScheduleVisitInput,
} from "../services/visits.service";
import { syncVisitCalendar } from "@/features/calendar-sync/sync-hooks";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

function revalidateVisitPaths(companyId?: string) {
  revalidatePath("/visits");
  revalidatePath("/agenda");
  revalidatePath("/");
  revalidatePath("/companies");
  if (companyId) {
    revalidatePath(`/companies/${companyId}`);
  }
}

export async function saveVisitAction(
  input: SaveVisitInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId.trim()) {
    return { success: false, message: "Azienda non valida." };
  }

  const { visitId, error } = await saveCompletedVisit({
    companyId: input.companyId,
    completedAt: input.completedAt || new Date().toISOString(),
    outcome: input.outcome?.trim() || null,
    notes: input.notes?.trim() || null,
    durationMinutes:
      input.durationMinutes != null && input.durationMinutes > 0
        ? Math.round(input.durationMinutes)
        : null,
    nextCallbackAt: input.nextCallbackAt || null,
  });

  if (error || !visitId) {
    return { success: false, message: error ?? "Salvataggio visita non riuscito." };
  }

  revalidateVisitPaths(input.companyId);

  return { success: true, message: "Visita registrata." };
}

export async function scheduleVisitAction(
  input: ScheduleVisitInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId.trim()) {
    return { success: false, message: "Seleziona un'azienda." };
  }

  if (!input.scheduledAt) {
    return { success: false, message: "Indica data e ora della visita." };
  }

  const { visitId, error } = await scheduleVisit({
    companyId: input.companyId,
    scheduledAt: input.scheduledAt,
    notes: input.notes,
  });

  if (error || !visitId) {
    return { success: false, message: error ?? "Pianificazione visita non riuscita." };
  }

  revalidateVisitPaths(input.companyId);

  await syncVisitCalendar(visitId, "upsert");

  return { success: true, message: "Visita pianificata." };
}

export async function completeScheduledVisitAction(
  visitId: string,
  companyId: string,
  input: CompleteScheduledVisitInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const { error } = await completeScheduledVisit(visitId, {
    completedAt: input.completedAt || new Date().toISOString(),
    outcome: input.outcome?.trim() || null,
    notes: input.notes?.trim() || null,
    durationMinutes:
      input.durationMinutes != null && input.durationMinutes > 0
        ? Math.round(input.durationMinutes)
        : null,
    nextCallbackAt: input.nextCallbackAt || null,
    checkInLatitude: input.checkInLatitude ?? null,
    checkInLongitude: input.checkInLongitude ?? null,
  });

  if (error) {
    return { success: false, message: error };
  }

  revalidateVisitPaths(companyId);

  await syncVisitCalendar(visitId, "complete");

  return { success: true, message: "Visita completata." };
}
