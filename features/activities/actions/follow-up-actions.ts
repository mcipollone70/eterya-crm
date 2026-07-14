"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isContactHistoryType } from "@/lib/constants/contact-history";
import type { ContactHistoryType } from "@/lib/constants/contact-history";
import type { ActivityPriority } from "@/lib/supabase/types";
import {
  cancelFollowUp,
  completeFollowUp,
  postponeFollowUp,
  saveFollowUp,
} from "../services/follow-ups.service";
import {
  syncFollowUpCalendar,
} from "@/features/calendar-sync/sync-hooks";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function saveFollowUpAction(input: {
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

  if (!input.companyId.trim()) {
    return { success: false, message: "Azienda non valida." };
  }

  if (!isContactHistoryType(input.activityType)) {
    return { success: false, message: "Tipo attività non valido." };
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

  revalidatePath("/activities");
  revalidatePath("/agenda");
  revalidatePath("/");
  revalidatePath("/visits");
  revalidatePath(`/companies/${input.companyId}`);

  await syncFollowUpCalendar(followUpId, "upsert");

  return { success: true, message: "Follow-up creato." };
}

export async function completeFollowUpAction(
  id: string,
  companyId: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const result = await completeFollowUp(id);
  if (result.success) {
    revalidatePath("/activities");
    revalidatePath("/agenda");
    revalidatePath("/");
    revalidatePath("/visits");
    revalidatePath(`/companies/${companyId}`);
    await syncFollowUpCalendar(id, "complete");
  }
  return result;
}

export async function postponeFollowUpAction(
  id: string,
  companyId: string,
  postponedTo?: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const result = await postponeFollowUp(id, postponedTo);
  if (result.success) {
    revalidatePath("/activities");
    revalidatePath("/agenda");
    revalidatePath("/");
    revalidatePath("/visits");
    revalidatePath(`/companies/${companyId}`);
    await syncFollowUpCalendar(id, "upsert");
  }
  return result;
}

export async function cancelFollowUpAction(
  id: string,
  companyId: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const result = await cancelFollowUp(id);
  if (result.success) {
    revalidatePath("/activities");
    revalidatePath("/agenda");
    revalidatePath("/");
    revalidatePath("/visits");
    revalidatePath(`/companies/${companyId}`);
    await syncFollowUpCalendar(id, "cancel");
  }
  return result;
}
