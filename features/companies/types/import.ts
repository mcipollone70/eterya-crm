export type CompanyImportField =
  | "name"
  | "vat_number"
  | "tax_code"
  | "address"
  | "street"
  | "street_number"
  | "city"
  | "province"
  | "postal_code"
  | "country"
  | "email"
  | "phone"
  | "contact_name"
  | "website"
  | "notes"
  | "skip"
  | "unknown";

export type ImportWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export type MappingConfidence = "high" | "medium" | "low" | "manual";

export type GeocodeStatus = "not_geocoded" | "geocoded" | "pending" | "failed";

export interface DetectedColumn {
  index: number;
  header: string;
  normalizedHeader: string;
  suggestedField: CompanyImportField;
  confidence: MappingConfidence;
}

export interface ImportFileAnalysis {
  fileName: string;
  sheetName: string;
  fileSize: number;
  headerRowIndex: number;
  columnCount: number;
  totalRows: number;
  companyCount: number;
  columns: DetectedColumn[];
  dataRows: string[][];
}

export interface ColumnMapping {
  columnIndex: number;
  sourceHeader: string;
  mappedField: CompanyImportField;
  confidence: MappingConfidence;
}

export interface CleaningReport {
  mergedStreetNumbers: number;
  normalizedPostalCodes: number;
  normalizedProvinces: number;
  normalizedCities: number;
  trimmedSpaces: number;
  removedSpecialChars: number;
}

export interface CompanyImportRecord {
  id: string;
  rowIndex: number;
  name: string;
  vatNumber: string;
  taxCode: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
  contactName: string;
  website: string;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  geocodeStatus: GeocodeStatus;
  issues: string[];
  isComplete: boolean;
  needsFix: boolean;
}

export interface ImportPreviewStats {
  totalCompanies: number;
  duplicateVatNumbers: number;
  duplicateTaxCodes: number;
  incompleteRecords: number;
  withoutPhone: number;
  withoutEmail: number;
  withoutAddress: number;
  geocodedRecords: number;
  recordsToFix: number;
}

export interface ImportWizardData {
  analysis: ImportFileAnalysis | null;
  columnMappings: ColumnMapping[];
  cleanedRecords: CompanyImportRecord[];
  cleaningReport: CleaningReport | null;
  previewStats: ImportPreviewStats | null;
}

export const COMPANY_FIELD_LABELS: Record<CompanyImportField, string> = {
  name: "Ragione sociale",
  vat_number: "Partita IVA",
  tax_code: "Codice Fiscale",
  address: "Indirizzo completo",
  street: "Via",
  street_number: "Civico",
  city: "Comune",
  province: "Provincia",
  postal_code: "CAP",
  country: "Nazione",
  email: "Email",
  phone: "Telefono",
  contact_name: "Referente",
  website: "Sito web",
  notes: "Note",
  skip: "Ignora colonna",
  unknown: "Non mappato",
};

export const MAPPABLE_FIELDS: CompanyImportField[] = [
  "name",
  "vat_number",
  "tax_code",
  "address",
  "street",
  "street_number",
  "city",
  "province",
  "postal_code",
  "country",
  "email",
  "phone",
  "contact_name",
  "website",
  "notes",
  "skip",
  "unknown",
];

export const GEOCODE_STATUS_LABELS: Record<GeocodeStatus, string> = {
  not_geocoded: "NON GEOCODIFICATE",
  geocoded: "GEOCODIFICATE",
  pending: "IN ATTESA",
  failed: "FALLITE",
};
