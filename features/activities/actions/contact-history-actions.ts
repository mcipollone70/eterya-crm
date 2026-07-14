"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isContactHistoryType, type ContactHistoryType } from "@/lib/constants/contact-history";
import {
  saveContactHistoryActivity,
  type SaveContactHistoryInput,
} from "../services/contact-history.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function saveContactHistoryAction(
  input: SaveContactHistoryInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId.trim()) {
    return { success: false, message: "Azienda non valida." };
  }

  if (!isContactHistoryType(input.type)) {
    return { success: false, message: "Tipo attività non valido." };
  }

  const { activityId, error } = await saveContactHistoryActivity({
    companyId: input.companyId,
    type: input.type as ContactHistoryType,
    title: input.title,
    description: input.description,
    outcome: input.outcome,
    occurredAt: input.occurredAt || new Date().toISOString(),
    nextFollowUpAt: input.nextFollowUpAt ?? null,
    visitId: input.visitId ?? null,
    attachments: input.attachments ?? [],
    source: input.source ?? "manual",
  });

  if (error || !activityId) {
    return { success: false, message: error ?? "Salvataggio attività non riuscito." };
  }

  revalidatePath("/activities");
  revalidatePath("/companies");
  revalidatePath(`/companies/${input.companyId}`);
  revalidatePath("/");

  return { success: true, message: "Attività registrata nello storico contatti." };
}
