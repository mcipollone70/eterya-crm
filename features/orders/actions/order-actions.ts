"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateDashboardPaths } from "@/lib/revalidate/dashboard-paths";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isProductFamily } from "@/lib/constants/product-catalog";
import { isOrderFulfillmentStatus } from "@/lib/constants/orders";
import type { OrderFulfillmentStatus } from "@/lib/supabase/types";
import {
  saveOrder,
  updateOrder,
  updateOrderStatus,
} from "../services/orders.service";
import type { SaveOrderInput, UpdateOrderInput } from "../types";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

function revalidateOrderPaths(orderId: string, companyId: string) {
  revalidatePath("/ordini");
  revalidatePath(`/ordini/${orderId}`);
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${orderId}`);
  revalidatePath("/preventivi");
  revalidatePath(`/preventivi/${orderId}`);
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
  revalidatePath("/activities");
  revalidateDashboardPaths();
}

export async function saveOrderAction(
  input: SaveOrderInput
): Promise<{ success: boolean; message: string; orderId?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId.trim() || !input.title.trim()) {
    return { success: false, message: "Azienda e titolo sono obbligatori." };
  }

  if (!isProductFamily(input.productFamily)) {
    return { success: false, message: "Famiglia prodotto obbligatoria." };
  }

  const { orderId, error } = await saveOrder(input);
  if (error || !orderId) {
    return { success: false, message: error ?? "Salvataggio ordine non riuscito." };
  }

  revalidateOrderPaths(orderId, input.companyId);
  return { success: true, message: "Ordine registrato.", orderId };
}

export async function updateOrderAction(
  orderId: string,
  input: UpdateOrderInput
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

  const { error } = await updateOrder(orderId, input);
  if (error) {
    return { success: false, message: error };
  }

  revalidateOrderPaths(orderId, input.companyId);
  redirect(`/ordini/${orderId}`);
}

export async function updateOrderStatusAction(
  orderId: string,
  companyId: string,
  orderStatus: OrderFulfillmentStatus
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!isOrderFulfillmentStatus(orderStatus)) {
    return { success: false, message: "Stato evasione non valido." };
  }

  const result = await updateOrderStatus(orderId, orderStatus);
  if (result.success) {
    revalidateOrderPaths(orderId, companyId);
  }
  return result;
}
