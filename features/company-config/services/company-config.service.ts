import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/types";

const COMPANY_PROFILE_KEY = "company_profile";

export interface CompanyConfig {
  companyName: string;
  vatNumber: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  defaultCurrency: string;
  quoteValidityDays: number;
  notes: string;
}

export const DEFAULT_COMPANY_CONFIG: CompanyConfig = {
  companyName: "",
  vatNumber: "",
  address: "",
  email: "",
  phone: "",
  website: "",
  defaultCurrency: "EUR",
  quoteValidityDays: 30,
  notes: "",
};

function parseConfig(value: unknown): CompanyConfig {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_COMPANY_CONFIG };
  }
  const record = value as Record<string, unknown>;
  const asString = (key: keyof CompanyConfig): string =>
    typeof record[key] === "string" ? (record[key] as string) : DEFAULT_COMPANY_CONFIG[key] as string;

  return {
    companyName: asString("companyName"),
    vatNumber: asString("vatNumber"),
    address: asString("address"),
    email: asString("email"),
    phone: asString("phone"),
    website: asString("website"),
    defaultCurrency: asString("defaultCurrency") || "EUR",
    quoteValidityDays:
      typeof record.quoteValidityDays === "number" ? record.quoteValidityDays : 30,
    notes: asString("notes"),
  };
}

export async function getCompanyConfig(): Promise<{
  data: CompanyConfig;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", COMPANY_PROFILE_KEY)
    .maybeSingle();

  if (error) {
    if (/app_settings|relation .* does not exist/i.test(error.message)) {
      return {
        data: { ...DEFAULT_COMPANY_CONFIG },
        error:
          "Tabella configurazione non trovata. Esegui la migrazione 20260715_app_settings.sql su Supabase.",
      };
    }
    return { data: { ...DEFAULT_COMPANY_CONFIG }, error: describeDbError(error) };
  }

  return { data: parseConfig(data?.value), error: null };
}

export async function saveCompanyConfig(
  config: CompanyConfig
): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  const supabase = await createServerClient();

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: COMPANY_PROFILE_KEY,
      value: config as unknown as Json,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    if (/app_settings|relation .* does not exist/i.test(error.message)) {
      return {
        error:
          "Tabella configurazione non trovata. Esegui la migrazione 20260715_app_settings.sql su Supabase.",
      };
    }
    return { error: describeDbError(error) };
  }

  return { error: null };
}
