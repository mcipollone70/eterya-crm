"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logAuditEvent } from "@/features/audit/services/audit-log.service";
import {
  isAdminActionError,
  requireAdminProfile,
} from "@/features/admin/services/admin-auth.service";
import {
  DEFAULT_COMPANY_CONFIG,
  saveCompanyConfig,
  type CompanyConfig,
} from "../services/company-config.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi le variabili Supabase in .env.local.";

export async function saveCompanyConfigAction(
  formData: FormData
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const profile = await requireAdminProfile();
  if (isAdminActionError(profile)) {
    return { success: false, message: profile.error ?? "Accesso riservato agli amministratori." };
  }

  const validityRaw = String(formData.get("quote_validity_days") ?? "");
  const validity = Number.parseInt(validityRaw, 10);

  const config: CompanyConfig = {
    companyName: String(formData.get("company_name") ?? "").trim(),
    vatNumber: String(formData.get("vat_number") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    defaultCurrency: String(formData.get("default_currency") ?? "EUR").trim() || "EUR",
    quoteValidityDays: Number.isFinite(validity) && validity > 0 ? validity : DEFAULT_COMPANY_CONFIG.quoteValidityDays,
    notes: String(formData.get("notes") ?? "").trim(),
  };

  const { error } = await saveCompanyConfig(config);
  if (error) {
    return { success: false, message: error };
  }

  await logAuditEvent({
    action: "config_update",
    entityType: "app_settings",
    summary: `Configurazione azienda aggiornata${config.companyName ? ` · ${config.companyName}` : ""}`,
  });

  revalidatePath("/configurazione");
  return { success: true, message: "Configurazione salvata." };
}
