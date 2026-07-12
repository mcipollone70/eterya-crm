import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { CompanyInsert } from "../utils/build-db-rows";

export interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

const BATCH_SIZE = 500;
const MAX_REPORTED_ERRORS = 20;

/**
 * Import massivo aziende su Supabase tramite il client server auth-scoped: la
 * scrittura gira come ruolo `authenticated` ed è soggetta alle policy RLS.
 * - Inserisce in batch da 500 righe.
 * - Se un batch fallisce (es. P.IVA duplicata sull'indice unico) ricade su
 *   insert riga-per-riga per isolare e saltare solo i record problematici.
 */
export async function importCompanyRows(
  rows: CompanyInsert[]
): Promise<ImportResult> {
  if (rows.length === 0) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: ["Nessuna azienda da importare."],
    };
  }

  const supabase = await createServerClient();
  const errors: string[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const { error } = await supabase.from("companies").insert(batch);

    if (!error) {
      importedCount += batch.length;
      continue;
    }

    // Fallback riga-per-riga per isolare i record che causano l'errore.
    for (const row of batch) {
      const { error: rowError } = await supabase.from("companies").insert(row);
      if (rowError) {
        skippedCount++;
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push(
            `Riga ${row.import_row_index ?? "?"} (${row.name}): ${rowError.message}`
          );
        }
      } else {
        importedCount++;
      }
    }
  }

  return {
    success: importedCount > 0,
    importedCount,
    skippedCount,
    errors,
  };
}
