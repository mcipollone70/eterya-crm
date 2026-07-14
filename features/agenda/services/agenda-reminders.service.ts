import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { FollowUpStatus } from "@/lib/constants/follow-up";
import type { Tables } from "@/lib/supabase/types";

export type AgendaReminder = Tables<"agenda_reminders">;

export interface SaveAgendaReminderInput {
  title: string;
  scheduledAt: string;
  notes?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
}

export interface UpdateAgendaReminderInput {
  title?: string;
  scheduledAt?: string;
  notes?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
}

async function resolveReminderUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function saveAgendaReminder(
  input: SaveAgendaReminderInput
): Promise<{ reminderId: string | null; error: string | null }> {
  const userId = await resolveReminderUserId();
  if (!userId) {
    return { reminderId: null, error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("agenda_reminders")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      scheduled_at: input.scheduledAt,
      notes: input.notes?.trim() || null,
      company_id: input.companyId ?? null,
      contact_id: input.contactId ?? null,
      opportunity_id: input.opportunityId ?? null,
      status: "todo",
    })
    .select("id")
    .single();

  if (error) {
    return { reminderId: null, error: describeDbError(error) };
  }

  return { reminderId: data.id, error: null };
}

export async function updateAgendaReminder(
  id: string,
  input: UpdateAgendaReminderInput
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const patch: {
    title?: string;
    scheduled_at?: string;
    notes?: string | null;
    company_id?: string | null;
    contact_id?: string | null;
    opportunity_id?: string | null;
  } = {};

  if (input.title !== undefined) {
    patch.title = input.title.trim();
  }
  if (input.scheduledAt !== undefined) {
    patch.scheduled_at = input.scheduledAt;
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }
  if (input.companyId !== undefined) {
    patch.company_id = input.companyId;
  }
  if (input.contactId !== undefined) {
    patch.contact_id = input.contactId;
  }
  if (input.opportunityId !== undefined) {
    patch.opportunity_id = input.opportunityId;
  }

  const { error } = await supabase.from("agenda_reminders").update(patch).eq("id", id);
  return { error: describeDbError(error) };
}

export async function completeAgendaReminder(id: string): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { data: existing, error: loadError } = await supabase
    .from("agenda_reminders")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return { error: describeDbError(loadError) };
  }
  if (!existing) {
    return { error: "Promemoria non trovato." };
  }
  if (existing.status === "completed") {
    return { error: "Promemoria già completato." };
  }
  if (existing.status === "cancelled") {
    return { error: "Promemoria annullato." };
  }

  const { error } = await supabase
    .from("agenda_reminders")
    .update({
      status: "completed" as FollowUpStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  return { error: describeDbError(error) };
}

export async function cancelAgendaReminder(id: string): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { data: existing, error: loadError } = await supabase
    .from("agenda_reminders")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return { error: describeDbError(loadError) };
  }
  if (!existing) {
    return { error: "Promemoria non trovato." };
  }
  if (existing.status === "cancelled") {
    return { error: "Promemoria già annullato." };
  }
  if (existing.status === "completed") {
    return { error: "Impossibile annullare un promemoria completato." };
  }

  const { error } = await supabase
    .from("agenda_reminders")
    .update({ status: "cancelled" as FollowUpStatus })
    .eq("id", id);

  return { error: describeDbError(error) };
}
