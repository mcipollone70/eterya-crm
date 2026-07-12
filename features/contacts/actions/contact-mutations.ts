"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formDataToRecord, type FormState } from "@/lib/forms";
import { CONTACT_TEXT_FIELDS } from "../utils/contact-fields";
import type { ContactInsert } from "../services/contacts.service";
import {
  deleteContactById,
  insertContact,
  updateContactById,
} from "../services/contacts.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

/** FormData → riga `contacts` (company_id e is_primary gestiti esplicitamente). */
function buildContactRow(formData: FormData): {
  row: ContactInsert | null;
  fieldErrors: Record<string, string> | null;
} {
  const companyId = String(formData.get("company_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!companyId) fieldErrors.company_id = "Seleziona un'azienda.";
  if (!fullName) fieldErrors.full_name = "Il nome completo è obbligatorio.";
  if (Object.keys(fieldErrors).length > 0) {
    return { row: null, fieldErrors };
  }

  const record = formDataToRecord(formData, CONTACT_TEXT_FIELDS);

  return {
    row: {
      ...record,
      company_id: companyId,
      full_name: fullName,
      is_primary: formData.get("is_primary") === "true",
    } as ContactInsert,
    fieldErrors: null,
  };
}

export async function createContactAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const { row, fieldErrors } = buildContactRow(formData);
  if (fieldErrors) {
    return { fieldErrors };
  }

  const { id, error } = await insertContact(row!);
  if (error || !id) {
    return { error: error ?? "Creazione del contatto non riuscita." };
  }

  revalidatePath("/contacts");
  revalidatePath(`/companies/${row!.company_id}`);
  redirect(`/contacts/${id}`);
}

export async function updateContactAction(
  id: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const { row, fieldErrors } = buildContactRow(formData);
  if (fieldErrors) {
    return { fieldErrors };
  }

  const { error } = await updateContactById(id, row!);
  if (error) {
    return { error };
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  revalidatePath(`/companies/${row!.company_id}`);
  redirect(`/contacts/${id}`);
}

export async function deleteContactAction(
  id: string,
  companyId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const { error } = await deleteContactById(id);
  if (error) {
    return { error };
  }

  revalidatePath("/contacts");
  revalidatePath(`/companies/${companyId}`);
  redirect("/contacts");
}
