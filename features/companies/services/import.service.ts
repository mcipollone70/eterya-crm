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
const INSERT_BATCH_SIZE = 100;
const VAT_LOOKUP_BATCH_SIZE = 200;

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

async function loadExistingCompaniesByVat(
  vatNumbers: string[]
): Promise<Map<string, string>> {
  const supabase = await createServerClient();
  const existingByVat = new Map<string, string>();

  for (let index = 0; index < vatNumbers.length; index += VAT_LOOKUP_BATCH_SIZE) {
    const chunk = vatNumbers.slice(index, index + VAT_LOOKUP_BATCH_SIZE);
    const { data, error } = await supabase
      .from("companies")
      .select("id,vat_number")
      .in("vat_number", chunk);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      if (row.vat_number) {
        existingByVat.set(row.vat_number, row.id);
      }
    }
  }

  return existingByVat;
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

  const rowsWithoutVat: CompanyInsert[] = [];
  const rowsWithVat: Array<CompanyInsert & { vat_number: string }> = [];

  for (const row of rows) {
    if (shouldSkipRow(row)) {
      skippedCount++;
      continue;
    }

    if (hasVatNumber(row)) {
      rowsWithVat.push({ ...row, vat_number: row.vat_number.trim() });
    } else {
      rowsWithoutVat.push(row);
    }
  }

  for (let index = 0; index < rowsWithoutVat.length; index += INSERT_BATCH_SIZE) {
    const chunk = rowsWithoutVat.slice(index, index + INSERT_BATCH_SIZE);
    const { error } = await supabase.from("companies").insert(chunk);

    if (error) {
      for (const row of chunk) {
        const { error: singleError } = await supabase.from("companies").insert(row);
        if (singleError) {
          if (errors.length < MAX_REPORTED_ERRORS) {
            errors.push(`${rowLabel(row)}: ${singleError.message}`);
          }
        } else {
          importedCount++;
        }
      }
      continue;
    }

    importedCount += chunk.length;
  }

  const uniqueVatNumbers = [...new Set(rowsWithVat.map((row) => row.vat_number))];
  let existingByVat = new Map<string, string>();

  try {
    existingByVat = await loadExistingCompaniesByVat(uniqueVatNumbers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore lookup P.IVA.";
    return {
      success: false,
      importedCount,
      updatedCount,
      skippedCount,
      errors: [message],
    };
  }

  for (const row of rowsWithVat) {
    const vat = row.vat_number;
    const existingId = existingByVat.get(vat);

    if (existingId) {
      const { error: updateError } = await supabase
        .from("companies")
        .update(row)
        .eq("id", existingId);

      if (updateError) {
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push(`${rowLabel(row)}: ${updateError.message}`);
        }
      } else {
        updatedCount++;
      }
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("companies")
      .insert(row)
      .select("id")
      .maybeSingle();

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

      existingByVat.set(vat, raced.id);

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
      continue;
    }

    if (inserted?.id) {
      existingByVat.set(vat, inserted.id);
    }
    importedCount++;
  }

  return {
    success: importedCount > 0 || updatedCount > 0,
    importedCount,
    updatedCount,
    skippedCount,
    errors,
  };
}
