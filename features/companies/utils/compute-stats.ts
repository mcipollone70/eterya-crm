import type { CompanyImportRecord, ImportPreviewStats } from "../types/import";
import { getDuplicateCount } from "./build-records";

export function computePreviewStats(records: CompanyImportRecord[]): ImportPreviewStats {
  const vatNumbers = records.map((r) => r.vatNumber);
  const taxCodes = records.map((r) => r.taxCode);

  return {
    totalCompanies: records.length,
    duplicateVatNumbers: getDuplicateCount(vatNumbers),
    duplicateTaxCodes: getDuplicateCount(taxCodes),
    incompleteRecords: records.filter((r) => !r.isComplete).length,
    withoutPhone: records.filter((r) => !r.phone).length,
    withoutEmail: records.filter((r) => !r.email).length,
    withoutAddress: records.filter((r) => !r.address).length,
    geocodedRecords: records.filter((r) => r.geocodeStatus === "geocoded").length,
    recordsToFix: records.filter((r) => r.needsFix).length,
  };
}
