"use server";

import { revalidatePath } from "next/cache";
import { listBrands } from "@/features/brands";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerClient } from "@/lib/supabase/server";
import { COMPANY_IMPORT_REVALIDATE_PATHS } from "../utils/agent-company-scope";
import {
  importCompanyRows,
  type ImportResult,
} from "../services/import.service";
import type { CompanyImportRowPayload } from "../utils/build-db-rows";
import type { CompanyImportBrandOptions } from "../types/import";
import { normalizeEmail, normalizeVat } from "../utils/import-dedupe";

export async function listActiveBrandsForImportAction(): Promise<{
  data: Array<{ id: string; name: string; slug: string; short_code: string | null }>;
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: "Supabase non configurato." };
  }

  const result = await listBrands({ activeOnly: true });
  if (result.error) {
    return { data: [], error: result.error };
  }

  return {
    data: result.data.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      short_code: brand.short_code,
    })),
    error: null,
  };
}

/** Conta righe file che potrebbero già esistere (match P.IVA o email in DB). */
export async function estimateExistingMatchesAction(
  rows: Array<{ vatNumber?: string; email?: string }>
): Promise<{ count: number; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { count: 0, error: null };
  }

  const vats = [
    ...new Set(rows.map((r) => normalizeVat(r.vatNumber)).filter(Boolean)),
  ].slice(0, 500);
  const emails = [
    ...new Set(rows.map((r) => normalizeEmail(r.email)).filter(Boolean)),
  ].slice(0, 500);

  if (vats.length === 0 && emails.length === 0) {
    return { count: 0, error: null };
  }

  try {
    const supabase = await createServerClient();
    const existingVats = new Set<string>();
    const existingEmails = new Set<string>();

    if (vats.length > 0) {
      const { data, error } = await supabase
        .from("companies")
        .select("vat_number")
        .in("vat_number", vats);
      if (error) return { count: 0, error: error.message };
      for (const row of data ?? []) {
        const vat = normalizeVat(row.vat_number);
        if (vat) existingVats.add(vat);
      }
    }

    if (emails.length > 0) {
      const { data, error } = await supabase
        .from("companies")
        .select("email")
        .in("email", emails);
      if (error) return { count: 0, error: error.message };
      for (const row of data ?? []) {
        const email = normalizeEmail(row.email);
        if (email) existingEmails.add(email);
      }
    }

    let count = 0;
    for (const row of rows) {
      const vat = normalizeVat(row.vatNumber);
      const email = normalizeEmail(row.email);
      if ((vat && existingVats.has(vat)) || (email && existingEmails.has(email))) {
        count += 1;
      }
    }

    return { count, error: null };
  } catch (error) {
    return {
      count: 0,
      error: error instanceof Error ? error.message : "Errore stima match.",
    };
  }
}

export async function importCompaniesAction(
  payloads: CompanyImportRowPayload[],
  brandOptions: CompanyImportBrandOptions
): Promise<ImportResult> {
  const empty: ImportResult = {
    success: false,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    brandLinksCreated: 0,
    brandLinksUpdated: 0,
    duplicatesAvoided: 0,
    errors: [],
    rowErrors: [],
  };

  if (!isSupabaseConfigured()) {
    return {
      ...empty,
      errors: [
        "Supabase non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.",
      ],
    };
  }

  if (!brandOptions?.brandId?.trim()) {
    return {
      ...empty,
      errors: ["Brand obbligatorio: seleziona un marchio prima di importare."],
    };
  }

  try {
    const result = await importCompanyRows(payloads, { brand: brandOptions });
    if (
      result.importedCount > 0 ||
      result.updatedCount > 0 ||
      result.brandLinksCreated > 0 ||
      result.brandLinksUpdated > 0
    ) {
      for (const path of COMPANY_IMPORT_REVALIDATE_PATHS) {
        revalidatePath(path);
      }
    }
    return result;
  } catch (error) {
    return {
      ...empty,
      errors: [
        error instanceof Error ? error.message : "Errore imprevisto durante l'import.",
      ],
    };
  }
}
