"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateDashboardPaths } from "@/lib/revalidate/dashboard-paths";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  isServiceTicketPriority,
  isServiceTicketStatus,
} from "@/lib/constants/service-tickets";
import {
  deleteServiceTicket,
  saveServiceTicket,
  updateServiceTicket,
  type SaveServiceTicketInput,
  type UpdateServiceTicketInput,
} from "../services/service-tickets.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

function revalidateTicketPaths(ticketId: string, companyId: string) {
  revalidatePath("/assistenza");
  revalidatePath(`/assistenza/${ticketId}`);
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
  revalidatePath("/activities");
  revalidateDashboardPaths();
}

function validate(input: SaveServiceTicketInput): string | null {
  if (!input.companyId.trim() || !input.title.trim()) {
    return "Azienda e titolo del ticket sono obbligatori.";
  }
  if (input.status && !isServiceTicketStatus(input.status)) {
    return "Stato ticket non valido.";
  }
  if (input.priority && !isServiceTicketPriority(input.priority)) {
    return "Priorità non valida.";
  }
  return null;
}

export async function saveServiceTicketAction(
  input: SaveServiceTicketInput
): Promise<{ success: boolean; message: string; ticketId?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const validationError = validate(input);
  if (validationError) {
    return { success: false, message: validationError };
  }

  const { ticketId, error } = await saveServiceTicket(input);
  if (error || !ticketId) {
    return { success: false, message: error ?? "Salvataggio ticket non riuscito." };
  }

  revalidateTicketPaths(ticketId, input.companyId);
  return { success: true, message: "Ticket di assistenza creato.", ticketId };
}

export async function updateServiceTicketAction(
  ticketId: string,
  input: UpdateServiceTicketInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const validationError = validate(input);
  if (validationError) {
    return { success: false, message: validationError };
  }

  const { error } = await updateServiceTicket(ticketId, input);
  if (error) {
    return { success: false, message: error };
  }

  revalidateTicketPaths(ticketId, input.companyId);
  redirect(`/assistenza/${ticketId}`);
}

export async function deleteServiceTicketAction(
  ticketId: string,
  companyId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const { error } = await deleteServiceTicket(ticketId);
  if (error) {
    return { error };
  }

  revalidateTicketPaths(ticketId, companyId);
  redirect("/assistenza");
}
