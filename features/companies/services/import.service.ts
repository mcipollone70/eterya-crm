import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { CompanyInsert } from "../utils/build-db-rows";

export interface ImportResult {
  success: boolean;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}

const MAX_REPORTED_ERRORS = 20;

function rowLabel(row: CompanyInsert): string {
  return `Riga ${row.import_row_index ?? "?"} (${row.name})`;
}

function shouldSkipRow(row: CompanyInsert): boolean {
  return !row.name?.trim();
}

function hasVatNumber(row: CompanyInsert): row is CompanyInsert & { vat_number: string } {
  const vat = row.vat_number?.trim();
  return Boolean(vat);
}

/**
 * Import massivo aziende su Supabase tramite il client server auth-scoped.
 * - Con P.IVA: upsert (UPDATE se esiste, INSERT altrimenti) su vat_number.
 * - Senza P.IVA: INSERT (consentiti più record con vat null).
 * - Non interrompe l'import al primo errore: processa tutte le righe.
 */
export async function importCompanyRows(
  rows: CompanyInsert[]
): Promise<ImportResult> {
  if (rows.length === 0) {
    return {
      success: false,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: ["Nessuna azienda da importare."],
    };
  }

  const supabase = await createServerClient();
  const errors: string[] = [];
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    if (shouldSkipRow(row)) {
      skippedCount++;
      continue;
    }

    if (!hasVatNumber(row)) {
      const { error } = await supabase.from("companies").insert(row);
      if (error) {
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push(`${rowLabel(row)}: ${error.message}`);
        }
      } else {
        importedCount++;
      }
      continue;
    }

    const vat = row.vat_number.trim();
    const { data: existing, error: selectError } = await supabase
      .from("companies")
      .select("id")
      .eq("vat_number", vat)
      .maybeSingle();

    if (selectError) {
      if (errors.length < MAX_REPORTED_ERRORS) {
        errors.push(`${rowLabel(row)}: ${selectError.message}`);
      }
      continue;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("companies")
        .update(row)
        .eq("id", existing.id);

      if (updateError) {
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push(`${rowLabel(row)}: ${updateError.message}`);
        }
      } else {
        updatedCount++;
      }
      continue;
    }

    const { error: insertError } = await supabase.from("companies").insert(row);

    if (insertError?.code === "23505") {
      const { data: raced, error: raceSelectError } = await supabase
        .from("companies")
        .select("id")
        .eq("vat_number", vat)
        .maybeSingle();

      if (raceSelectError || !raced) {
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push(
            `${rowLabel(row)}: ${raceSelectError?.message ?? insertError.message}`
          );
        }
        continue;
      }

      const { error: updateError } = await supabase
        .from("companies")
        .update(row)
        .eq("id", raced.id);

      if (updateError) {
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push(`${rowLabel(row)}: ${updateError.message}`);
        }
      } else {
        updatedCount++;
      }
      continue;
    }

    if (insertError) {
      if (errors.length < MAX_REPORTED_ERRORS) {
        errors.push(`${rowLabel(row)}: ${insertError.message}`);
      }
    } else {
      importedCount++;
    }
  }

  return {
    success: importedCount > 0 || updatedCount > 0,
    importedCount,
    updatedCount,
    skippedCount,
    errors,
  };
}
