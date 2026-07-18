import type { BrandRelationshipStatus } from "@/lib/supabase/types";

export type CompanyImportField =
  | "name"
  | "vat_number"
  | "tax_code"
  | "address"
  | "street"
  | "street_number"
  | "city"
  | "province"
  | "region"
  | "postal_code"
  | "country"
  | "email"
  | "phone_prefix"
  | "phone"
  | "mobile"
  | "contact_name"
  | "contact_role"
  | "customer_code"
  | "website"
  | "notes"
  | "skip"
  | "unknown";

export type ImportWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export type MappingConfidence = "high" | "medium" | "low" | "manual";

export type GeocodeStatus =
  | "not_geocoded"
  | "geocoded"
  | "pending"
  | "failed"
  | "completed"
  | "needs_review";

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
  street: string;
  streetNumber: string;
  city: string;
  province: string;
  region: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
  mobile: string;
  contactName: string;
  contactRole: string;
  customerCode: string;
  website: string;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  geocodeStatus: GeocodeStatus;
  geocodingError?: string | null;
  geocodingNormalizedAddress?: string | null;
  issues: string[];
  isComplete: boolean;
  needsFix: boolean;
}

export interface ImportPreviewStats {
  totalCompanies: number;
  validRecords: number;
  missingNameRecords: number;
  duplicateInFile: number;
  duplicateVatNumbers: number;
  duplicateTaxCodes: number;
  incompleteRecords: number;
  withoutPhone: number;
  withoutEmail: number;
  withoutAddress: number;
  geocodedRecords: number;
  recordsToFix: number;
  /** Stima lato client: righe con P.IVA/email già tipiche di match DB (opzionale). */
  possibleExistingMatches: number;
}

/** Opzioni Brand / relazione scelte prima dell'upload. */
export interface CompanyImportBrandOptions {
  brandId: string;
  brandName: string;
  relationshipStatus: BrandRelationshipStatus;
  setPrimaryIfNone: boolean;
  /** Se true, sovrascrive campi azienda già valorizzati. Default false = solo campi vuoti. */
  overwriteExistingFields: boolean;
}

export interface ImportWizardData {
  analysis: ImportFileAnalysis | null;
  columnMappings: ColumnMapping[];
  cleanedRecords: CompanyImportRecord[];
  cleaningReport: CleaningReport | null;
  previewStats: ImportPreviewStats | null;
}

export const COMPANY_FIELD_LABELS: Record<CompanyImportField, string> = {
  name: "Ragione sociale / nome azienda",
  vat_number: "Partita IVA",
  tax_code: "Codice fiscale",
  address: "Indirizzo completo",
  street: "Via",
  street_number: "Numero civico",
  city: "Comune",
  province: "Provincia",
  region: "Regione",
  postal_code: "CAP",
  country: "Nazione",
  email: "Email",
  phone_prefix: "Prefisso",
  phone: "Telefono",
  mobile: "Cellulare",
  contact_name: "Referente",
  contact_role: "Ruolo referente",
  customer_code: "Codice cliente",
  website: "Sito web",
  notes: "Note",
  skip: "Ignora colonna",
  unknown: "Non mappato",
};

export const MAPPABLE_FIELDS: CompanyImportField[] = [
  "name",
  "vat_number",
  "tax_code",
  "email",
  "phone_prefix",
  "phone",
  "mobile",
  "address",
  "street",
  "street_number",
  "postal_code",
  "city",
  "province",
  "region",
  "country",
  "contact_name",
  "contact_role",
  "customer_code",
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
  completed: "GEOCODIFICATE",
  needs_review: "DA VERIFICARE",
};

export const IMPORT_RELATIONSHIP_UI_OPTIONS: Array<{
  value: BrandRelationshipStatus;
  label: string;
}> = [
  { value: "customer", label: "Cliente" },
  { value: "prospect", label: "Prospect" },
  { value: "former_customer", label: "Ex cliente" },
];
