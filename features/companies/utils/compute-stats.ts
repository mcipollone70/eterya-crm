import type { CompanyImportRecord, ImportPreviewStats } from "../types/import";
import { countFileLevelDuplicates, getDuplicateCount } from "./build-records";

export function computePreviewStats(records: CompanyImportRecord[]): ImportPreviewStats {
  const vatNumbers = records.map((r) => r.vatNumber);
  const taxCodes = records.map((r) => r.taxCode);
  const missingName = records.filter((r) => !r.name.trim()).length;
  const validRecords = records.filter((r) => Boolean(r.name.trim())).length;

  return {
    totalCompanies: records.length,
    validRecords,
    missingNameRecords: missingName,
    duplicateInFile: countFileLevelDuplicates(records),
    duplicateVatNumbers: getDuplicateCount(vatNumbers),
    duplicateTaxCodes: getDuplicateCount(taxCodes),
    incompleteRecords: records.filter((r) => !r.isComplete).length,
    withoutPhone: records.filter((r) => !r.phone && !r.mobile).length,
    withoutEmail: records.filter((r) => !r.email).length,
    withoutAddress: records.filter((r) => !r.address).length,
    geocodedRecords: records.filter(
      (r) => r.geocodeStatus === "geocoded" || r.geocodeStatus === "completed"
    ).length,
    recordsToFix: records.filter((r) => r.needsFix).length,
    possibleExistingMatches: records.filter((r) => Boolean(r.vatNumber || r.email)).length,
  };
}
