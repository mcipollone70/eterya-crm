import type {
  CleaningReport,
  ColumnMapping,
  CompanyImportRecord,
  ImportFileAnalysis,
} from "../types/import";
import {
  cleanTextField,
  concatenatePhoneNumber,
  createEmptyCleaningReport,
  mergeCleaningReports,
  mergeStreetAndNumber,
  normalizeCity,
  normalizePostalCode,
  normalizeProvince,
} from "./clean-data";
import { normalizeHeader } from "./detect-headers";
import { countInFileDuplicates } from "./import-dedupe";

function generateRecordId(rowIndex: number): string {
  return `import-${rowIndex}-${crypto.randomUUID()}`;
}

function evaluateRecord(
  record: Omit<CompanyImportRecord, "isComplete" | "needsFix" | "issues">
): {
  issues: string[];
  isComplete: boolean;
  needsFix: boolean;
} {
  const issues: string[] = [];

  if (!record.name) issues.push("Ragione sociale mancante");
  if (!record.address) issues.push("Indirizzo mancante");
  if (!record.city) issues.push("Comune mancante");
  if (!record.vatNumber && !record.taxCode) issues.push("P.IVA o Codice Fiscale mancante");
  if (!record.phone && !record.mobile) issues.push("Telefono mancante");
  if (!record.email) issues.push("Email mancante");

  const isComplete = Boolean(record.name && record.address && record.city);
  const needsFix = issues.length > 0;

  return { issues, isComplete, needsFix };
}

function buildHeaderIndexMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    map.set(header, index);
    map.set(normalizeHeader(header), index);
  });
  return map;
}

function getMappedCellValue(
  row: string[],
  mapping: ColumnMapping,
  headerIndex: Map<string, number>
): string {
  const index =
    headerIndex.get(mapping.sourceHeader) ??
    headerIndex.get(normalizeHeader(mapping.sourceHeader)) ??
    mapping.columnIndex;

  return row[index]?.trim() ?? "";
}

const PHONE_PREFIX_HEADERS = new Set([
  "prefisso",
  "prefisso telefonico",
  "prefisso tel",
  "pref tel",
  "pref",
  "prefix",
]);

const PHONE_NUMBER_HEADERS = new Set([
  "telefono",
  "tel",
  "phone",
  "fax",
  "numero telefono",
  "n telefono",
]);

const MOBILE_HEADERS = new Set([
  "cellulare",
  "mobile",
  "cell",
  "telefono cellulare",
  "tel cellulare",
  "gsm",
]);

function isPhonePrefixHeader(normalized: string): boolean {
  return PHONE_PREFIX_HEADERS.has(normalized);
}

function isMobileHeader(normalized: string): boolean {
  return MOBILE_HEADERS.has(normalized) || normalized.includes("cellular");
}

function isPhoneNumberHeader(normalized: string): boolean {
  if (isPhonePrefixHeader(normalized) || isMobileHeader(normalized)) return false;
  if (PHONE_NUMBER_HEADERS.has(normalized)) return true;
  return normalized.includes("telefono") && !normalized.includes("prefisso");
}

function getPhoneParts(
  row: string[],
  mappings: ColumnMapping[],
  headerIndex: Map<string, number>,
  headers: string[]
): { prefix: string; number: string; mobile: string } {
  let prefix = "";
  let number = "";
  let mobile = "";

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const value = row[index]?.trim() ?? "";
    if (!value) return;

    if (isPhonePrefixHeader(normalized)) {
      prefix = value;
      return;
    }

    if (isMobileHeader(normalized)) {
      mobile = value;
      return;
    }

    if (isPhoneNumberHeader(normalized)) {
      number = value;
    }
  });

  for (const mapping of mappings) {
    const value = getMappedCellValue(row, mapping, headerIndex);
    if (!value) continue;

    const normalizedHeader = normalizeHeader(mapping.sourceHeader);

    if (mapping.mappedField === "phone_prefix") {
      if (!prefix) prefix = value;
      continue;
    }

    if (mapping.mappedField === "mobile") {
      if (!mobile) mobile = value;
      continue;
    }

    if (mapping.mappedField === "phone") {
      if (isPhonePrefixHeader(normalizedHeader)) {
        if (!prefix) prefix = value;
        continue;
      }
      if (isMobileHeader(normalizedHeader)) {
        if (!mobile) mobile = value;
        continue;
      }
      if (!number) number = value;
    }
  }

  return { prefix, number, mobile };
}

function cleanSingleRecord(
  row: string[],
  rowIndex: number,
  mappings: ColumnMapping[],
  headerIndex: Map<string, number>,
  headers: string[]
): { record: CompanyImportRecord; report: CleaningReport } {
  const report = createEmptyCleaningReport();

  const rawFields: Record<string, string> = {};
  for (const mapping of mappings) {
    if (mapping.mappedField === "skip" || mapping.mappedField === "unknown") continue;
    rawFields[mapping.mappedField] = getMappedCellValue(row, mapping, headerIndex);
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

  const { prefix: phonePrefix, number: phoneNumber, mobile } = getPhoneParts(
    row,
    mappings,
    headerIndex,
    headers
  );
  const phone = concatenatePhoneNumber(phonePrefix, phoneNumber);

  const baseRecord = {
    id: generateRecordId(rowIndex),
    rowIndex,
    name: cleanField("name"),
    vatNumber: cleanField("vat_number").replace(/\s/g, "").toUpperCase(),
    taxCode: cleanField("tax_code").replace(/\s/g, "").toUpperCase(),
    address,
    street,
    streetNumber,
    city,
    province,
    region: cleanField("region"),
    postalCode,
    country: cleanField("country") || "IT",
    email: cleanField("email").toLowerCase(),
    phone,
    mobile: mobile || cleanField("mobile"),
    contactName: cleanField("contact_name"),
    contactRole: cleanField("contact_role"),
    customerCode: cleanField("customer_code"),
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
  const headers = analysis.columns.map((column) => column.header);
  const headerIndex = buildHeaderIndexMap(headers);

  analysis.dataRows.forEach((row, index) => {
    const { record, report: rowReport } = cleanSingleRecord(
      row,
      index + 1,
      mappings,
      headerIndex,
      headers
    );
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

export function countFileLevelDuplicates(records: CompanyImportRecord[]): number {
  return countInFileDuplicates(records);
}
