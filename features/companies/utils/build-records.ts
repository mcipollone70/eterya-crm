import type {
  CleaningReport,
  ColumnMapping,
  CompanyImportRecord,
  ImportFileAnalysis,
} from "../types/import";
import {
  cleanTextField,
  createEmptyCleaningReport,
  mergeCleaningReports,
  mergeStreetAndNumber,
  normalizeCity,
  normalizePostalCode,
  normalizeProvince,
} from "./clean-data";

function generateRecordId(rowIndex: number): string {
  return `import-${rowIndex}-${crypto.randomUUID()}`;
}

function evaluateRecord(record: Omit<CompanyImportRecord, "isComplete" | "needsFix" | "issues">): {
  issues: string[];
  isComplete: boolean;
  needsFix: boolean;
} {
  const issues: string[] = [];

  if (!record.name) issues.push("Ragione sociale mancante");
  if (!record.address) issues.push("Indirizzo mancante");
  if (!record.city) issues.push("Comune mancante");
  if (!record.vatNumber && !record.taxCode) issues.push("P.IVA o Codice Fiscale mancante");
  if (!record.phone) issues.push("Telefono mancante");
  if (!record.email) issues.push("Email mancante");

  const isComplete = Boolean(record.name && record.address && record.city);
  const needsFix = issues.length > 0;

  return { issues, isComplete, needsFix };
}

function cleanSingleRecord(
  row: string[],
  rowIndex: number,
  mappings: ColumnMapping[]
): { record: CompanyImportRecord; report: CleaningReport } {
  const report = createEmptyCleaningReport();

  const rawFields: Record<string, string> = {};
  for (const mapping of mappings) {
    if (mapping.mappedField === "skip" || mapping.mappedField === "unknown") continue;
    rawFields[mapping.mappedField] = row[mapping.columnIndex]?.trim() ?? "";
  }

  const cleanField = (key: string) => {
    const result = cleanTextField(rawFields[key] ?? "");
    if (result.trimmed) report.trimmedSpaces++;
    if (result.sanitized) report.removedSpecialChars++;
    return result.value;
  };

  let address = cleanField("address");
  const street = cleanField("street");
  const streetNumber = cleanField("street_number");

  if (!address && (street || streetNumber)) {
    address = mergeStreetAndNumber(street, streetNumber);
    if (address) report.mergedStreetNumbers++;
  }

  const rawPostal = rawFields.postal_code ?? "";
  const postalCode = normalizePostalCode(cleanField("postal_code"));
  if (postalCode && postalCode !== rawPostal.replace(/\D/g, "").padStart(5, "0")) {
    report.normalizedPostalCodes++;
  }

  const rawProvince = rawFields.province ?? "";
  const province = normalizeProvince(cleanField("province"));
  if (province && province !== rawProvince.toUpperCase()) {
    report.normalizedProvinces++;
  }

  const rawCity = rawFields.city ?? "";
  const city = normalizeCity(cleanField("city"));
  if (city && city !== rawCity) {
    report.normalizedCities++;
  }

  const baseRecord = {
    id: generateRecordId(rowIndex),
    rowIndex,
    name: cleanField("name"),
    vatNumber: cleanField("vat_number").replace(/\s/g, "").toUpperCase(),
    taxCode: cleanField("tax_code").replace(/\s/g, "").toUpperCase(),
    address,
    city,
    province,
    postalCode,
    country: cleanField("country") || "IT",
    email: cleanField("email").toLowerCase(),
    phone: cleanField("phone"),
    contactName: cleanField("contact_name"),
    website: cleanField("website"),
    notes: cleanField("notes"),
    latitude: null,
    longitude: null,
    geocodeStatus: "not_geocoded" as const,
  };

  const evaluation = evaluateRecord(baseRecord);

  return {
    record: { ...baseRecord, ...evaluation },
    report,
  };
}

export function buildAndCleanRecords(
  analysis: ImportFileAnalysis,
  mappings: ColumnMapping[]
): { records: CompanyImportRecord[]; report: CleaningReport } {
  let report = createEmptyCleaningReport();
  const records: CompanyImportRecord[] = [];

  analysis.dataRows.forEach((row, index) => {
    const { record, report: rowReport } = cleanSingleRecord(row, index + 1, mappings);
    records.push(record);
    report = mergeCleaningReports(report, rowReport);
  });

  return { records, report };
}

export function hasRequiredMapping(mappings: ColumnMapping[]): boolean {
  return mappings.some((m) => m.mappedField === "name");
}

export function getDuplicateCount(values: string[]): number {
  const normalized = values.filter(Boolean).map((v) => v.toUpperCase());
  const seen = new Map<string, number>();

  for (const value of normalized) {
    seen.set(value, (seen.get(value) ?? 0) + 1);
  }

  let duplicates = 0;
  for (const count of seen.values()) {
    if (count > 1) duplicates += count;
  }

  return duplicates;
}
