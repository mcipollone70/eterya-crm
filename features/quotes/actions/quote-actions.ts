"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateDashboardPaths } from "@/lib/revalidate/dashboard-paths";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isProductFamily } from "@/lib/constants/product-catalog";
import { isQuoteStatus } from "@/lib/constants/quotes";
import type { OpportunityStatus } from "@/lib/supabase/types";
import {
  convertQuoteToOrder,
  duplicateQuote,
  saveQuote,
  sendQuote,
  updateQuote,
  updateQuoteStatus,
} from "../services/quotes.service";
import type { SaveQuoteInput, UpdateQuoteInput } from "../types";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

function revalidateQuotePaths(quoteId: string, companyId: string) {
  revalidatePath("/preventivi");
  revalidatePath(`/preventivi/${quoteId}`);
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${quoteId}`);
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
  revalidatePath("/ordini");
  revalidatePath("/activities");
  revalidateDashboardPaths();
}

export async function saveQuoteAction(
  input: SaveQuoteInput
): Promise<{ success: boolean; message: string; quoteId?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId.trim() || !input.title.trim()) {
    return { success: false, message: "Azienda e titolo sono obbligatori." };
  }

  if (!isProductFamily(input.productFamily)) {
    return { success: false, message: "Famiglia prodotto obbligatoria." };
  }

  const { quoteId, error } = await saveQuote(input);
  if (error || !quoteId) {
    return { success: false, message: error ?? "Salvataggio preventivo non riuscito." };
  }

  revalidateQuotePaths(quoteId, input.companyId);
  return { success: true, message: "Preventivo creato.", quoteId };
}

export async function createQuoteAndRedirectAction(
  input: SaveQuoteInput
): Promise<{ success: boolean; message: string }> {
  const result = await saveQuoteAction(input);
  if (!result.success || !result.quoteId) {
    return { success: false, message: result.message };
  }
  redirect(`/preventivi/${result.quoteId}`);
}

export async function updateQuoteAction(
  quoteId: string,
  input: UpdateQuoteInput
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

  if (input.status && !isQuoteStatus(input.status)) {
    return { success: false, message: "Stato non valido." };
  }

  // Status transitions that also set stage/sent_at/accepted_at (or convert to order)
  // must go through updateQuoteStatus — never update status alone via updateQuote.
  const statusTransition =
    input.status === "sent" ||
    input.status === "accepted" ||
    input.status === "rejected" ||
    input.status === "expired" ||
    input.status === "cancelled"
      ? input.status
      : null;

  const { error } = await updateQuote(quoteId, {
    ...input,
    status: statusTransition ? undefined : input.status,
  });
  if (error) {
    return { success: false, message: error };
  }

  if (statusTransition) {
    const statusResult = await updateQuoteStatus(quoteId, statusTransition);
    if (!statusResult.success) {
      return { success: false, message: statusResult.message };
    }
    revalidateQuotePaths(quoteId, input.companyId);
    if (statusResult.orderId) {
      revalidatePath(`/ordini/${statusResult.orderId}`);
      redirect(`/ordini/${statusResult.orderId}`);
    }
  } else {
    revalidateQuotePaths(quoteId, input.companyId);
  }

  redirect(`/preventivi/${quoteId}`);
}

export async function sendQuoteAction(
  quoteId: string,
  companyId: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const result = await sendQuote(quoteId);
  if (result.success) {
    revalidateQuotePaths(quoteId, companyId);
  }
  return result;
}

export async function updateQuoteStatusAction(
  quoteId: string,
  companyId: string,
  status: OpportunityStatus
): Promise<{ success: boolean; message: string; orderId?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!isQuoteStatus(status)) {
    return { success: false, message: "Stato non valido." };
  }

  const result = await updateQuoteStatus(quoteId, status);
  if (result.success) {
    revalidateQuotePaths(quoteId, companyId);
    if (result.orderId) {
      revalidatePath(`/ordini/${result.orderId}`);
    }
  }
  return result;
}

export async function duplicateQuoteAction(
  quoteId: string,
  companyId: string
): Promise<{ success: boolean; message: string; quoteId?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const { quoteId: newId, error } = await duplicateQuote(quoteId);
  if (error || !newId) {
    return { success: false, message: error ?? "Duplicazione non riuscita." };
  }

  revalidateQuotePaths(newId, companyId);
  return { success: true, message: "Preventivo duplicato.", quoteId: newId };
}

export async function convertQuoteToOrderAction(
  quoteId: string,
  companyId: string
): Promise<{ success: boolean; message: string; orderId?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const { orderId, error } = await convertQuoteToOrder(quoteId);
  if (error || !orderId) {
    return { success: false, message: error ?? "Conversione non riuscita." };
  }

  revalidateQuotePaths(quoteId, companyId);
  revalidatePath(`/ordini/${orderId}`);
  revalidatePath("/ordini");
  return { success: true, message: "Preventivo convertito in ordine.", orderId };
}

