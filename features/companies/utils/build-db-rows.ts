import {
  EXCEL_COLUMN_COUNT,
  EXCEL_COLUMN_NAMES,
  type InsertTables,
  type Json,
} from "@/lib/supabase/types";
import type { CompanyImportRecord, ImportFileAnalysis } from "../types/import";

export type CompanyInsert = InsertTables<"companies">;

function nullify(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Costruisce una riga `companies` pronta per l'insert combinando i campi
 * strutturati puliti, i 76 slot posizionali Excel e il payload JSONB completo
 * (zero data loss: ogni colonna del file resta recuperabile).
 */
export function buildCompanyInsertRow(
  record: CompanyImportRecord,
  rawRow: string[],
  headers: string[],
  fileName: string
): CompanyInsert {
  const payload: Record<string, string> = {};
  headers.forEach((header, index) => {
    const value = rawRow[index];
    if (value != null && String(value).trim() !== "") {
      payload[header] = String(value);
    }
  });

  const row: CompanyInsert = {
    name: record.name || `Riga ${record.rowIndex}`,
    vat_number: nullify(record.vatNumber),
    tax_code: nullify(record.taxCode),
    address: nullify(record.address),
    city: nullify(record.city),
    province: nullify(record.province),
    postal_code: nullify(record.postalCode),
    country: nullify(record.country) ?? "IT",
    email: nullify(record.email),
    phone: nullify(record.phone),
    contact_name: nullify(record.contactName),
    website: nullify(record.website),
    notes: nullify(record.notes),
    latitude: record.latitude,
    longitude: record.longitude,
    geocode_status: record.geocodeStatus,
    import_source: "excel_wizard",
    import_file_name: fileName,
    import_row_index: record.rowIndex,
    import_headers: headers.slice(0, EXCEL_COLUMN_COUNT),
    import_payload: payload as Json,
    import_column_count: Math.min(headers.length, EXCEL_COLUMN_COUNT),
  };

  EXCEL_COLUMN_NAMES.forEach((column, index) => {
    row[column] = nullify(rawRow[index]);
  });

  return row;
}

export function buildCompanyInsertRows(
  analysis: ImportFileAnalysis,
  records: CompanyImportRecord[],
  fileName: string
): CompanyInsert[] {
  const headers = analysis.columns.map((column) => column.header);
  return records.map((record) =>
    buildCompanyInsertRow(
      record,
      analysis.dataRows[record.rowIndex - 1] ?? [],
      headers,
      fileName
    )
  );
}
