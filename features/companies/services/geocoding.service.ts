import type { CompanyImportRecord } from "../types/import";

/**
 * Servizio geocoding — stub pronto per integrazione MapTiler/Nominatim.
 * Attualmente imposta tutte le coordinate come NON GEOCODIFICATE.
 */
export interface GeocodingResult {
  records: CompanyImportRecord[];
  geocodedCount: number;
  failedCount: number;
}

export async function geocodeRecords(
  records: CompanyImportRecord[]
): Promise<GeocodingResult> {
  const geocodedRecords = records.map((record) => ({
    ...record,
    latitude: null,
    longitude: null,
    geocodeStatus: "not_geocoded" as const,
  }));

  return {
    records: geocodedRecords,
    geocodedCount: 0,
    failedCount: 0,
  };
}
