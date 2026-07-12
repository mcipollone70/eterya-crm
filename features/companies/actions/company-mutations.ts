"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  flattenFields,
  formDataToRecord,
  validateRequired,
  type FormState,
} from "@/lib/forms";
import { COMPANY_FORM_SECTIONS } from "../utils/company-fields";
import type { CompanyInsert } from "../utils/build-db-rows";
import {
  deleteCompanyById,
  insertCompany,
  updateCompanyById,
} from "../services/companies.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

const COMPANY_FIELDS = flattenFields(COMPANY_FORM_SECTIONS);

/** FormData → riga `companies`, con fallback per i NOT NULL con default DB. */
function buildCompanyRow(formData: FormData): CompanyInsert {
  const record = formDataToRecord(formData, COMPANY_FIELDS);
  return {
    ...record,
    name: String(record.name ?? "").trim(),
    status: (record.status as string) || "prospect",
    country: (record.country as string) || "IT",
  } as CompanyInsert;
}

export async function createCompanyAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const fieldErrors = validateRequired(formData, COMPANY_FIELDS);
  if (fieldErrors) {
    return { fieldErrors };
  }

  const { id, error } = await insertCompany(buildCompanyRow(formData));
  if (error || !id) {
    return { error: error ?? "Creazione dell'azienda non riuscita." };
  }

  revalidatePath("/companies");
  redirect(`/companies/${id}`);
}

export async function updateCompanyAction(
  id: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const fieldErrors = validateRequired(formData, COMPANY_FIELDS);
  if (fieldErrors) {
    return { fieldErrors };
  }

  const { error } = await updateCompanyById(id, buildCompanyRow(formData));
  if (error) {
    return { error };
  }

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  redirect(`/companies/${id}`);
}

export async function deleteCompanyAction(
  id: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const { error } = await deleteCompanyById(id);
  if (error) {
    return { error };
  }

  revalidatePath("/companies");
  redirect("/companies");
}
