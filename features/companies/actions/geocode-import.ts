"use server";

import { isGeoapifyConfigured } from "@/lib/geoapify/env";
import {
  geocodeImportRecords,
  type ImportGeocodingResult,
} from "../services/company-geocoding.service";
import type { CompanyImportRecord } from "../types/import";

export async function geocodeImportRecordsAction(
  records: CompanyImportRecord[]
): Promise<ImportGeocodingResult> {
  if (!isGeoapifyConfigured()) {
    return {
      records: records.map((record) => ({
        ...record,
        geocodeStatus: "not_geocoded",
      })),
      geocodedCount: 0,
      failedCount: 0,
      needsReviewCount: 0,
      message: "GEOAPIFY_API_KEY non configurata. Le aziende verranno importate senza coordinate.",
    };
  }

  return geocodeImportRecords(records);
}
