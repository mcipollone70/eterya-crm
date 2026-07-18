"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  isInterestLevel,
  isProductFamily,
} from "@/lib/constants/product-catalog";
import { saveProduct, updateProduct, type SaveProductInput } from "../services/products.service";
import {
  addCompanyProductInterest,
  removeCompanyProductInterest,
  type AddCompanyProductInput,
} from "../services/company-product-interests.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function saveProductAction(
  input: SaveProductInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.name.trim() || !isProductFamily(input.family)) {
    return { success: false, message: "Nome e famiglia prodotto sono obbligatori." };
  }

  const { productId, error } = await saveProduct(input);
  if (error || !productId) {
    return { success: false, message: error ?? "Salvataggio prodotto non riuscito." };
  }

  revalidatePath("/products");
  revalidatePath("/companies");

  return { success: true, message: "Prodotto creato nel catalogo." };
}

export async function updateProductAction(
  productId: string,
  input: SaveProductInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.name.trim() || !isProductFamily(input.family)) {
    return { success: false, message: "Nome e famiglia prodotto sono obbligatori." };
  }

  const { error } = await updateProduct(productId, input);
  if (error) {
    return { success: false, message: error };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/companies");

  return { success: true, message: "Prodotto aggiornato." };
}

export async function addCompanyProductAction(
  input: AddCompanyProductInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!input.companyId || !input.productId) {
    return { success: false, message: "Azienda e prodotto sono obbligatori." };
  }

  if (
    input.relationType === "interest" &&
    input.interestLevel &&
    !isInterestLevel(input.interestLevel)
  ) {
    return { success: false, message: "Livello di interesse non valido." };
  }

  const result = await addCompanyProductInterest(input);
  if (result.success) {
    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath("/companies");
    revalidatePath("/");
  }

  return result;
}

export async function removeCompanyProductAction(
  interestId: string,
  companyId: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!interestId || !companyId) {
    return { success: false, message: "Parametri mancanti." };
  }

  const result = await removeCompanyProductInterest(interestId, companyId);
  if (result.success) {
    revalidatePath(`/companies/${companyId}`);
    revalidatePath("/companies");
    revalidatePath("/");
  }

  return result;
}
