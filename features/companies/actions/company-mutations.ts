"use server";

import { revalidatePath } from "next/cache";
import { revalidateDashboardPaths } from "@/lib/revalidate/dashboard-paths";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isCommercialStatus } from "@/lib/constants/commercial-status";
import {
  flattenFields,
  formDataToRecord,
  validateRequired,
  type FormState,
} from "@/lib/forms";
import { COMPANY_FORM_SECTIONS } from "../utils/company-fields";
import type { CommercialStatus } from "@/lib/supabase/types";
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
    commercial_status: (record.commercial_status as CommercialStatus) || "prospect",
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
  revalidateDashboardPaths();
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
  revalidateDashboardPaths();
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
  revalidateDashboardPaths();
  redirect("/companies");
}

export async function updateCommercialStatusAction(
  id: string,
  commercialStatus: CommercialStatus
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  if (!isCommercialStatus(commercialStatus)) {
    return { error: "Stato commerciale non valido." };
  }

  const { error } = await updateCompanyById(id, {
    commercial_status: commercialStatus,
  });
  if (error) {
    return { error };
  }

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  revalidateDashboardPaths();
  return {};
}
