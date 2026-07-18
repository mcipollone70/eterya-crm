"use server";

import { revalidatePath } from "next/cache";
import { revalidateDashboardPaths } from "@/lib/revalidate/dashboard-paths";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isContactHistoryType } from "@/lib/constants/contact-history";
import type { ContactHistoryType } from "@/lib/constants/contact-history";
import type { ActivityPriority } from "@/lib/supabase/types";
import {
  cancelFollowUp,
  completeFollowUp,
  postponeFollowUp,
  saveFollowUp,
  updateFollowUp,
} from "@/features/activities/services/follow-ups.service";
import {
  cancelVisit,
  completeScheduledVisit,
  scheduleVisit,
  updateScheduledVisit,
  type CompleteScheduledVisitInput,
} from "@/features/visits/services/visits.service";
import {
  cancelAgendaReminder,
  completeAgendaReminder,
  saveAgendaReminder,
  updateAgendaReminder,
} from "../services/agenda-reminders.service";
import { parseAgendaItemId } from "@/lib/constants/agenda";
import {
  syncFollowUpCalendar,
  syncReminderCalendar,
  syncVisitCalendar,
} from "@/features/calendar-sync/sync-hooks";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

function revalidateAgendaPaths(companyId?: string | null) {
  revalidatePath("/agenda");
  revalidatePath("/visits");
  revalidatePath("/activities");
  revalidatePath("/companies");
  revalidateDashboardPaths();
  if (companyId) {
    revalidatePath(`/companies/${companyId}`);
  }
}

export async function agendaScheduleVisitAction(input: {
  companyId: string;
  scheduledAt: string;
  notes?: string | null;
}): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId.trim()) {
    return { success: false, message: "Seleziona un'azienda." };
  }

  const { visitId, error } = await scheduleVisit(input);
  if (error || !visitId) {
    return { success: false, message: error ?? "Pianificazione visita non riuscita." };
  }

  revalidateAgendaPaths(input.companyId);
  await syncVisitCalendar(visitId, "upsert");
  return { success: true, message: "Visita pianificata." };
}

export async function agendaSaveFollowUpAction(input: {
  companyId: string;
  contactId?: string | null;
  activityType: string;
  description?: string | null;
  priority?: ActivityPriority;
  scheduledAt: string;
}): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!isContactHistoryType(input.activityType)) {
    return { success: false, message: "Tipo attività non valido." };
  }

  if (!input.companyId.trim()) {
    return { success: false, message: "Seleziona un'azienda." };
  }

  const { followUpId, error } = await saveFollowUp({
    companyId: input.companyId,
    contactId: input.contactId ?? null,
    activityType: input.activityType as ContactHistoryType,
    description: input.description,
    priority: input.priority,
    scheduledAt: input.scheduledAt,
  });

  if (error || !followUpId) {
    return { success: false, message: error ?? "Salvataggio follow-up non riuscito." };
  }

  revalidateAgendaPaths(input.companyId);
  await syncFollowUpCalendar(followUpId, "upsert");
  return { success: true, message: "Follow-up creato." };
}

export async function agendaSaveReminderAction(input: {
  title: string;
  scheduledAt: string;
  notes?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
}): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.title.trim()) {
    return { success: false, message: "Inserisci un titolo per il promemoria." };
  }

  const { reminderId, error } = await saveAgendaReminder(input);
  if (error || !reminderId) {
    return { success: false, message: error ?? "Salvataggio promemoria non riuscito." };
  }

  revalidateAgendaPaths(input.companyId);
  await syncReminderCalendar(reminderId, "upsert");
  return { success: true, message: "Promemoria creato." };
}

export async function agendaCompleteItemAction(
  compositeId: string,
  companyId?: string | null
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const parsed = parseAgendaItemId(compositeId);
  if (!parsed) {
    return { success: false, message: "Appuntamento non valido." };
  }

  if (parsed.kind === "google_event") {
    return {
      success: false,
      message:
        "Gli eventi Google non si completano dal CRM. Modificali in Google Calendar oppure crea un appuntamento CRM separato.",
    };
  }

  if (parsed.kind === "visit") {
    const result = await completeScheduledVisit(parsed.sourceId, {
      completedAt: new Date().toISOString(),
      outcome: null,
      notes: null,
      durationMinutes: null,
      nextCallbackAt: null,
    });
    if (result.error) {
      return { success: false, message: result.error };
    }
    revalidateAgendaPaths(companyId);
    await syncVisitCalendar(parsed.sourceId, "complete");
    return { success: true, message: "Visita completata." };
  }

  if (parsed.kind === "follow_up") {
    const result = await completeFollowUp(parsed.sourceId);
    if (!result.success) {
      return result;
    }
    revalidateAgendaPaths(companyId);
    await syncFollowUpCalendar(parsed.sourceId, "complete");
    return result;
  }

  if (parsed.kind !== "reminder") {
    return { success: false, message: "Appuntamento non valido." };
  }

  const result = await completeAgendaReminder(parsed.sourceId);
  if (result.error) {
    return { success: false, message: result.error };
  }
  revalidateAgendaPaths(companyId);
  await syncReminderCalendar(parsed.sourceId, "complete");
  return { success: true, message: "Promemoria completato." };
}

export async function agendaCompleteVisitAction(
  compositeId: string,
  companyId: string,
  input: CompleteScheduledVisitInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const parsed = parseAgendaItemId(compositeId);
  if (!parsed || parsed.kind !== "visit") {
    return { success: false, message: "Visita non valida." };
  }

  const { error } = await completeScheduledVisit(parsed.sourceId, input);
  if (error) {
    return { success: false, message: error };
  }

  revalidateAgendaPaths(companyId);
  await syncVisitCalendar(parsed.sourceId, "complete");
  return { success: true, message: "Visita completata." };
}

export async function agendaCancelItemAction(
  compositeId: string,
  companyId?: string | null
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const parsed = parseAgendaItemId(compositeId);
  if (!parsed) {
    return { success: false, message: "Appuntamento non valido." };
  }

  if (parsed.kind === "google_event") {
    return {
      success: false,
      message:
        "Gli eventi Google non si annullano dal CRM. Modificali in Google Calendar.",
    };
  }

  if (parsed.kind === "visit") {
    const result = await cancelVisit(parsed.sourceId);
    if (result.error) {
      return { success: false, message: result.error };
    }
    revalidateAgendaPaths(companyId);
    await syncVisitCalendar(parsed.sourceId, "cancel");
    return { success: true, message: "Visita annullata." };
  }

  if (parsed.kind === "follow_up") {
    const result = await cancelFollowUp(parsed.sourceId);
    if (!result.success) {
      return result;
    }
    revalidateAgendaPaths(companyId);
    await syncFollowUpCalendar(parsed.sourceId, "cancel");
    return result;
  }

  if (parsed.kind !== "reminder") {
    return { success: false, message: "Appuntamento non valido." };
  }

  const result = await cancelAgendaReminder(parsed.sourceId);
  if (result.error) {
    return { success: false, message: result.error };
  }
  revalidateAgendaPaths(companyId);
  await syncReminderCalendar(parsed.sourceId, "cancel");
  return { success: true, message: "Promemoria annullato." };
}

export async function agendaPostponeFollowUpAction(
  compositeId: string,
  companyId: string,
  postponedTo?: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const parsed = parseAgendaItemId(compositeId);
  if (!parsed || parsed.kind !== "follow_up") {
    return { success: false, message: "Follow-up non valido." };
  }

  const result = await postponeFollowUp(parsed.sourceId, postponedTo);
  if (!result.success) {
    return result;
  }

  revalidateAgendaPaths(companyId);
  await syncFollowUpCalendar(parsed.sourceId, "upsert");
  return result;
}

export async function agendaUpdateItemAction(input: {
  compositeId: string;
  companyId?: string | null;
  scheduledAt?: string;
  notes?: string | null;
  title?: string;
  activityType?: string;
  priority?: ActivityPriority;
  contactId?: string | null;
  opportunityId?: string | null;
}): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const parsed = parseAgendaItemId(input.compositeId);
  if (!parsed) {
    return { success: false, message: "Appuntamento non valido." };
  }

  if (parsed.kind === "google_event") {
    return {
      success: false,
      message:
        "Gli eventi Google non si modificano dal CRM. Modificali in Google Calendar.",
    };
  }

  if (parsed.kind === "visit") {
    const result = await updateScheduledVisit(parsed.sourceId, {
      scheduledAt: input.scheduledAt,
      notes: input.notes,
    });
    if (result.error) {
      return { success: false, message: result.error };
    }
    revalidateAgendaPaths(input.companyId);
    await syncVisitCalendar(parsed.sourceId, "upsert");
    return { success: true, message: "Visita aggiornata." };
  }

  if (parsed.kind === "follow_up") {
    if (input.activityType && !isContactHistoryType(input.activityType)) {
      return { success: false, message: "Tipo attività non valido." };
    }

    const result = await updateFollowUp(parsed.sourceId, {
      scheduledAt: input.scheduledAt,
      description: input.notes,
      activityType: input.activityType as ContactHistoryType | undefined,
      priority: input.priority,
      contactId: input.contactId,
    });
    if (result.error) {
      return { success: false, message: result.error };
    }
    revalidateAgendaPaths(input.companyId);
    await syncFollowUpCalendar(parsed.sourceId, "upsert");
    return { success: true, message: "Follow-up aggiornato." };
  }

  const result = await updateAgendaReminder(parsed.sourceId, {
    title: input.title,
    scheduledAt: input.scheduledAt,
    notes: input.notes,
    contactId: input.contactId,
    opportunityId: input.opportunityId,
  });
  if (result.error) {
    return { success: false, message: result.error };
  }
  revalidateAgendaPaths(input.companyId);
  await syncReminderCalendar(parsed.sourceId, "upsert");
  return { success: true, message: "Promemoria aggiornato." };
}
