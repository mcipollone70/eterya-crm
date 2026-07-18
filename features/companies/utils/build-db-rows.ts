import {
  EXCEL_COLUMN_COUNT,
  EXCEL_COLUMN_NAMES,
  type BrandRelationshipStatus,
  type CommercialStatus,
  type InsertTables,
  type Json,
} from "@/lib/supabase/types";
import type { CompanyImportRecord, ImportFileAnalysis } from "../types/import";

export type CompanyInsert = InsertTables<"companies">;

export interface CompanyImportRowPayload {
  company: CompanyInsert;
  customerCode: string | null;
  rowIndex: number;
  recordName: string;
}

function nullify(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Mappa relazione Brand → commercial_status legacy (compatibilità UI). */
export function commercialStatusFromBrandRelationship(
  status: BrandRelationshipStatus
): CommercialStatus {
  switch (status) {
    case "customer":
      return "cliente";
    case "former_customer":
      return "ex_cliente";
    case "prospect":
    default:
      return "prospect";
  }
}

/**
 * Costruisce una riga `companies` pronta per l'insert combinando i campi
 * strutturati puliti, i 76 slot posizionali Excel e il payload JSONB completo.
 */
export function buildCompanyInsertRow(
  record: CompanyImportRecord,
  rawRow: string[],
  headers: string[],
  fileName: string,
  options?: { relationshipStatus?: BrandRelationshipStatus }
): CompanyInsert {
  const payload: Record<string, string> = {};
  headers.forEach((header, index) => {
    const value = rawRow[index];
    if (value != null && String(value).trim() !== "") {
      payload[header] = String(value);
    }
  });

  const hasGeoapifyResult =
    record.geocodeStatus === "completed" || record.geocodeStatus === "needs_review";

  const relationship = options?.relationshipStatus ?? "prospect";

  const row: CompanyInsert = {
    name: record.name || `Riga ${record.rowIndex}`,
    vat_number: nullify(record.vatNumber),
    tax_code: nullify(record.taxCode),
    address: nullify(record.address),
    street: nullify(record.street),
    street_number: nullify(record.streetNumber),
    city: nullify(record.city),
    province: nullify(record.province),
    region: nullify(record.region),
    postal_code: nullify(record.postalCode),
    country: nullify(record.country) ?? "IT",
    email: nullify(record.email),
    phone: nullify(record.phone),
    mobile: nullify(record.mobile),
    contact_name: nullify(record.contactName),
    contact_role: nullify(record.contactRole),
    website: nullify(record.website),
    notes: nullify(record.notes),
    latitude: record.latitude,
    longitude: record.longitude,
    geocode_status: record.geocodeStatus,
    geocoding_provider: hasGeoapifyResult ? "geoapify" : null,
    geocoded_at: record.geocodeStatus === "completed" ? new Date().toISOString() : null,
    geocoding_error: record.geocodingError ?? null,
    geocoding_normalized_address: record.geocodingNormalizedAddress ?? null,
    commercial_status: commercialStatusFromBrandRelationship(relationship),
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

export function buildCompanyImportPayloads(
  analysis: ImportFileAnalysis,
  records: CompanyImportRecord[],
  fileName: string,
  relationshipStatus: BrandRelationshipStatus
): CompanyImportRowPayload[] {
  const headers = analysis.columns.map((column) => column.header);
  return records.map((record) => ({
    company: buildCompanyInsertRow(
      record,
      analysis.dataRows[record.rowIndex - 1] ?? [],
      headers,
      fileName,
      { relationshipStatus }
    ),
    customerCode: nullify(record.customerCode),
    rowIndex: record.rowIndex,
    recordName: record.name,
  }));
}

/** Compatibilità con chiamate precedenti (solo companies). */
export function buildCompanyInsertRows(
  analysis: ImportFileAnalysis,
  records: CompanyImportRecord[],
  fileName: string,
  relationshipStatus: BrandRelationshipStatus = "prospect"
): CompanyInsert[] {
  return buildCompanyImportPayloads(
    analysis,
    records,
    fileName,
    relationshipStatus
  ).map((item) => item.company);
}
