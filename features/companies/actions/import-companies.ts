"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { importCompanyRows, type ImportResult } from "../services/import.service";
import type { CompanyInsert } from "../utils/build-db-rows";

export async function importCompaniesAction(
  rows: CompanyInsert[]
): Promise<ImportResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: [
        "Supabase non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.",
      ],
    };
  }

  try {
    const result = await importCompanyRows(rows);
    if (result.importedCount > 0) {
      revalidatePath("/companies");
    }
    return result;
  } catch (error) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: [
        error instanceof Error ? error.message : "Errore imprevisto durante l'import.",
      ],
    };
  }
}
