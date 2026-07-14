import "server-only";

import { isGeocodedStatus } from "@/lib/constants/geocoding-status";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { GeocodeStatus, UpdateTables } from "@/lib/supabase/types";
import type {
  AddressCorrectionInput,
  CompanyGeocodingBatchResult,
  CompanyNeedingReview,
  GeocodingSummary,
} from "../types/geocoding";
import type { CompanyImportRecord, GeocodeStatus as ImportGeocodeStatus } from "../types/import";
import { buildFullAddress } from "../utils/build-full-address";
import {
  GEOCODE_SEARCH_LIMIT,
  resolveGeocodeAddress,
  type GeocodeResolution,
} from "../utils/resolve-geocode";
import {
  GEOAPIFY_PROVIDER,
  GeoapifyProviderError,
  isGeoapifyRetryableError,
  searchGeoapify,
  sleep,
} from "./geoapify.provider";

const BATCH_LIMIT = 100;
const MAX_CONCURRENCY = 3;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

export type {
  GeocodingSummary,
  CompanyGeocodingBatchResult,
  CompanyNeedingReview,
  AddressCorrectionInput,
} from "../types/geocoding";

export interface CompanyGeocodingCandidate {
  id: string;
  name: string;
  address: string | null;
  street: string | null;
  street_number: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_status: GeocodeStatus;
}

const CANDIDATE_COLUMNS =
  "id,name,address,street,street_number,postal_code,city,province,country,latitude,longitude,geocode_status";

const ELIGIBLE_STATUSES: GeocodeStatus[] = ["not_geocoded", "failed", "pending"];

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let index = 0;

  async function runWorker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker()
  );

  await Promise.all(workers);
  return results;
}

async function searchGeoapifyWithRetry(
  address: string
): Promise<Awaited<ReturnType<typeof searchGeoapify>>["results"]> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await searchGeoapify(address, { limit: GEOCODE_SEARCH_LIMIT });
      return response.results;
    } catch (error) {
      lastError = error;

      if (!isGeoapifyRetryableError(error) || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }

      await sleep(RETRY_DELAYS_MS[attempt]!);
    }
  }

  throw lastError;
}

async function resolveCompanyGeocode(
  company: CompanyAddressParts
): Promise<GeocodeResolution> {
  return resolveGeocodeAddress(company, searchGeoapifyWithRetry);
}

type CompanyAddressParts = {
  address?: string | null;
  street?: string | null;
  street_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
};

async function persistGeocodeResolution(
  companyId: string,
  resolution: GeocodeResolution
): Promise<"succeeded" | "failed" | "needsReview"> {
  if (resolution.status === "failed" || !resolution.result) {
    if (resolution.reason === "Indirizzo insufficiente per la geocodifica") {
      const saveError = await saveGeocodeResult(companyId, {
        geocode_status: "needs_review",
        geocoding_error: resolution.reason,
        geocoding_provider: GEOAPIFY_PROVIDER,
      });
      return saveError ? "failed" : "needsReview";
    }

    const saveError = await saveGeocodeResult(companyId, {
      geocode_status: "failed",
      geocoding_error: resolution.reason ?? "Nessun risultato Geoapify",
      geocoding_provider: GEOAPIFY_PROVIDER,
    });
    return saveError ? "failed" : "failed";
  }

  const nextStatus = resolution.status === "completed" ? "completed" : "needs_review";

  const saveError = await saveGeocodeResult(companyId, {
    latitude: resolution.result.latitude,
    longitude: resolution.result.longitude,
    geocode_status: nextStatus,
    geocoding_accuracy: resolution.result.accuracy,
    geocoding_provider: GEOAPIFY_PROVIDER,
    geocoded_at: new Date().toISOString(),
    geocoding_error: resolution.reason,
    geocoding_normalized_address: resolution.result.normalizedAddress,
  });

  if (saveError) {
    return "failed";
  }

  return nextStatus === "completed" ? "succeeded" : "needsReview";
}

function mapResolutionToImportRecord(
  record: CompanyImportRecord,
  resolution: GeocodeResolution
): CompanyImportRecord {
  if (resolution.status === "failed" || !resolution.result) {
    if (resolution.reason === "Indirizzo insufficiente per la geocodifica") {
      return {
        ...record,
        latitude: null,
        longitude: null,
        geocodeStatus: "needs_review",
        geocodingError: resolution.reason,
        geocodingNormalizedAddress: null,
      };
    }

    return {
      ...record,
      latitude: null,
      longitude: null,
      geocodeStatus: "needs_review",
      geocodingError: resolution.reason ?? "Nessun risultato Geoapify",
      geocodingNormalizedAddress: null,
    };
  }

  const nextStatus: ImportGeocodeStatus =
    resolution.status === "completed" ? "completed" : "needs_review";

  return {
    ...record,
    latitude: resolution.result.latitude,
    longitude: resolution.result.longitude,
    geocodeStatus: nextStatus,
    geocodingError: resolution.reason,
    geocodingNormalizedAddress: resolution.result.normalizedAddress,
  };
}

function importRecordToAddressParts(record: CompanyImportRecord): CompanyAddressParts {
  return {
    address: record.address,
    city: record.city,
    province: record.province,
    postal_code: record.postalCode,
    country: record.country,
  };
}

async function geocodeSingleImportRecord(
  record: CompanyImportRecord
): Promise<CompanyImportRecord> {
  const parts = importRecordToAddressParts(record);

  if (!buildFullAddress(parts)) {
    return {
      ...record,
      latitude: null,
      longitude: null,
      geocodeStatus: "needs_review",
      geocodingError: "Indirizzo insufficiente per la geocodifica",
      geocodingNormalizedAddress: null,
    };
  }

  try {
    const resolution = await resolveCompanyGeocode(parts);
    return mapResolutionToImportRecord(record, resolution);
  } catch (error) {
    const message =
      error instanceof GeoapifyProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Errore geocodifica";

    return {
      ...record,
      latitude: null,
      longitude: null,
      geocodeStatus: "needs_review",
      geocodingError: message,
      geocodingNormalizedAddress: null,
    };
  }
}

export interface ImportGeocodingResult {
  records: CompanyImportRecord[];
  geocodedCount: number;
  failedCount: number;
  needsReviewCount: number;
  message: string | null;
}

/**
 * Geocodifica i record dell'import Excel con Geoapify (stessa logica del batch DB).
 * Non persiste su database: aggiorna solo i record in memoria del wizard.
 */
export async function geocodeImportRecords(
  records: CompanyImportRecord[]
): Promise<ImportGeocodingResult> {
  if (records.length === 0) {
    return {
      records: [],
      geocodedCount: 0,
      failedCount: 0,
      needsReviewCount: 0,
      message: "Nessun record da geocodificare.",
    };
  }

  const geocodedRecords = await mapWithConcurrency(records, MAX_CONCURRENCY, (record) =>
    geocodeSingleImportRecord(record)
  );

  const geocodedCount = geocodedRecords.filter((r) => r.geocodeStatus === "completed").length;
  const needsReviewCount = geocodedRecords.filter((r) => r.geocodeStatus === "needs_review").length;
  const failedCount = geocodedRecords.filter((r) => r.geocodeStatus === "failed").length;

  return {
    records: geocodedRecords,
    geocodedCount,
    failedCount,
    needsReviewCount,
    message: `Geocodificate ${geocodedCount} aziende, ${needsReviewCount} da verificare.`,
  };
}

export async function getGeocodingSummary(): Promise<{
  data: GeocodingSummary | null;
  error: string | null;
}> {
  const supabase = await createServerClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_geocoding_summary" as never
  );

  if (!rpcError && rpcData && typeof rpcData === "object") {
    const row = rpcData as Record<string, unknown>;
    return {
      data: {
        withoutCoordinates: Number(row.withoutCoordinates ?? 0),
        geocoded: Number(row.geocoded ?? 0),
        needsReview: Number(row.needsReview ?? 0),
        failed: Number(row.failed ?? 0),
      },
      error: null,
    };
  }

  const [withoutRes, geocodedRes, needsReviewRes, failedRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .or("latitude.is.null,longitude.is.null")
      .in("geocode_status", ["not_geocoded", "pending", "processing"]),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .in("geocode_status", ["geocoded", "completed"])
      .not("latitude", "is", null)
      .not("longitude", "is", null),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("geocode_status", "needs_review"),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("geocode_status", "failed"),
  ]);

  const firstError =
    withoutRes.error ?? geocodedRes.error ?? needsReviewRes.error ?? failedRes.error;

  if (firstError) {
    return { data: null, error: describeDbError(firstError) };
  }

  return {
    data: {
      withoutCoordinates: withoutRes.count ?? 0,
      geocoded: geocodedRes.count ?? 0,
      needsReview: needsReviewRes.count ?? 0,
      failed: failedRes.count ?? 0,
    },
    error: null,
  };
}

export async function fetchCompaniesNeedingGeocode(
  limit = BATCH_LIMIT
): Promise<{ data: CompanyGeocodingCandidate[]; error: string | null }> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("companies")
    .select(CANDIDATE_COLUMNS)
    .or("latitude.is.null,longitude.is.null")
    .in("geocode_status", ELIGIBLE_STATUSES)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return { data: (data ?? []) as CompanyGeocodingCandidate[], error: null };
}

const REVIEW_COLUMNS =
  "id,name,address,street,street_number,postal_code,city,province,country,latitude,longitude,geocoding_normalized_address";

function mapCompanyNeedingReview(
  row: Omit<CompanyNeedingReview, "originalAddress">
): CompanyNeedingReview {
  return {
    ...row,
    originalAddress: buildFullAddress(row),
  };
}

async function saveGeocodeResult(
  companyId: string,
  payload: UpdateTables<"companies">
): Promise<string | null> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").update(payload).eq("id", companyId);

  if (error) {
    return describeDbError(error);
  }

  return null;
}

async function processCompany(
  company: CompanyGeocodingCandidate
): Promise<"succeeded" | "failed" | "needsReview" | "skipped"> {
  if (
    company.latitude !== null &&
    company.longitude !== null &&
    isGeocodedStatus(company.geocode_status)
  ) {
    return "skipped";
  }

  const fullAddress = buildFullAddress(company);

  if (!fullAddress) {
    await saveGeocodeResult(company.id, {
      geocode_status: "needs_review",
      geocoding_error: "Indirizzo insufficiente per la geocodifica",
      geocoding_provider: GEOAPIFY_PROVIDER,
    });
    return "needsReview";
  }

  const processingError = await saveGeocodeResult(company.id, {
    geocode_status: "processing",
    geocoding_error: null,
  });

  if (processingError) {
    return "failed";
  }

  try {
    const resolution = await resolveCompanyGeocode(company);
    return persistGeocodeResolution(company.id, resolution);
  } catch (error) {
    const message =
      error instanceof GeoapifyProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Errore geocodifica";

    await saveGeocodeResult(company.id, {
      geocode_status: "failed",
      geocoding_error: message,
      geocoding_provider: GEOAPIFY_PROVIDER,
    });

    return "failed";
  }
}

/**
 * Esegue la geocodifica a blocchi (max 100, concorrenza 3) con chiamate reali a Geoapify.
 */
export async function runCompanyGeocodingBatch(): Promise<CompanyGeocodingBatchResult> {
  const { data: candidates, error } = await fetchCompaniesNeedingGeocode(BATCH_LIMIT);

  if (error) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      needsReview: 0,
      skipped: 0,
      message: error,
    };
  }

  if (candidates.length === 0) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      needsReview: 0,
      skipped: 0,
      message: "Nessuna azienda da geolocalizzare.",
    };
  }

  const outcomes = await mapWithConcurrency(candidates, MAX_CONCURRENCY, (company) =>
    processCompany(company)
  );

  const succeeded = outcomes.filter((o) => o === "succeeded").length;
  const failed = outcomes.filter((o) => o === "failed").length;
  const needsReview = outcomes.filter((o) => o === "needsReview").length;
  const skipped = outcomes.filter((o) => o === "skipped").length;

  return {
    processed: candidates.length,
    succeeded,
    failed,
    needsReview,
    skipped,
    message: `Elaborate ${candidates.length} aziende: ${succeeded} geolocalizzate, ${needsReview} da verificare, ${failed} fallite.`,
  };
}

export async function listCompaniesNeedingReview(): Promise<{
  data: CompanyNeedingReview[];
  error: string | null;
}> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("companies")
    .select(REVIEW_COLUMNS)
    .eq("geocode_status", "needs_review")
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return {
    data: (data ?? []).map((row) =>
      mapCompanyNeedingReview(row as Omit<CompanyNeedingReview, "originalAddress">)
    ),
    error: null,
  };
}

export async function confirmGeocodePosition(
  companyId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerClient();

  const { data: company, error: fetchError } = await supabase
    .from("companies")
    .select("id,geocode_status")
    .eq("id", companyId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, message: describeDbError(fetchError) ?? "Errore database." };
  }

  if (!company) {
    return { success: false, message: "Azienda non trovata." };
  }

  if (company.geocode_status !== "needs_review") {
    return { success: false, message: "L'azienda non è in stato da verificare." };
  }

  const saveError = await saveGeocodeResult(companyId, {
    geocode_status: "completed",
    geocoding_error: null,
  });

  if (saveError) {
    return { success: false, message: saveError };
  }

  return { success: true, message: "Posizione confermata." };
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const REVIEW_FETCH_COLUMNS =
  "id,name,address,street,street_number,postal_code,city,province,country,latitude,longitude,geocoding_normalized_address,geocode_status";

type ReviewCompanyRow = Omit<CompanyNeedingReview, "originalAddress"> & {
  geocode_status: GeocodeStatus;
};

export async function regeocodeCompanyWithAddress(
  companyId: string,
  addressUpdate: AddressCorrectionInput
): Promise<{ success: boolean; message: string; geocode_status?: GeocodeStatus }> {
  const supabase = await createServerClient();

  const { data, error: fetchError } = await supabase
    .from("companies")
    .select(REVIEW_FETCH_COLUMNS)
    .eq("id", companyId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, message: describeDbError(fetchError) ?? "Errore database." };
  }

  const company = data as ReviewCompanyRow | null;

  if (!company) {
    return { success: false, message: "Azienda non trovata." };
  }

  if (company.geocode_status !== "needs_review") {
    return { success: false, message: "L'azienda non è in stato da verificare." };
  }

  const updatedCompany: ReviewCompanyRow = {
    ...company,
    address: trimOrNull(addressUpdate.address) ?? company.address,
    street: trimOrNull(addressUpdate.street) ?? company.street,
    street_number: trimOrNull(addressUpdate.street_number) ?? company.street_number,
    postal_code: trimOrNull(addressUpdate.postal_code) ?? company.postal_code,
    city: trimOrNull(addressUpdate.city) ?? company.city,
    province: trimOrNull(addressUpdate.province) ?? company.province,
    country: trimOrNull(addressUpdate.country) ?? company.country ?? "IT",
  };

  const fullAddress = buildFullAddress(updatedCompany);

  if (!fullAddress) {
    return { success: false, message: "Indirizzo insufficiente per la geocodifica." };
  }

  const processingError = await saveGeocodeResult(companyId, {
    geocode_status: "processing",
    geocoding_error: null,
    address: updatedCompany.address,
    street: updatedCompany.street,
    street_number: updatedCompany.street_number,
    postal_code: updatedCompany.postal_code,
    city: updatedCompany.city,
    province: updatedCompany.province,
    country: updatedCompany.country ?? "IT",
  });

  if (processingError) {
    return { success: false, message: processingError };
  }

  try {
    const resolution = await resolveCompanyGeocode(updatedCompany);

    if (resolution.status === "failed" && !resolution.result) {
      await saveGeocodeResult(companyId, {
        geocode_status: "needs_review",
        geocoding_error: resolution.reason ?? "Geocodifica non riuscita",
        geocoding_provider: GEOAPIFY_PROVIDER,
        address: updatedCompany.address,
        street: updatedCompany.street,
        street_number: updatedCompany.street_number,
        postal_code: updatedCompany.postal_code,
        city: updatedCompany.city,
        province: updatedCompany.province,
        country: updatedCompany.country ?? "IT",
      });

      return {
        success: false,
        message: resolution.reason ?? "Geocodifica non riuscita",
      };
    }

    if (!resolution.result) {
      return { success: false, message: resolution.reason ?? "Geocodifica non riuscita" };
    }

    const nextStatus: GeocodeStatus =
      resolution.status === "completed" ? "completed" : "needs_review";

    const saveError = await saveGeocodeResult(companyId, {
      latitude: resolution.result.latitude,
      longitude: resolution.result.longitude,
      geocode_status: nextStatus,
      geocoding_accuracy: resolution.result.accuracy,
      geocoding_provider: GEOAPIFY_PROVIDER,
      geocoded_at: new Date().toISOString(),
      geocoding_error: resolution.reason,
      geocoding_normalized_address: resolution.result.normalizedAddress,
      address: updatedCompany.address,
      street: updatedCompany.street,
      street_number: updatedCompany.street_number,
      postal_code: updatedCompany.postal_code,
      city: updatedCompany.city,
      province: updatedCompany.province,
      country: updatedCompany.country ?? "IT",
    });

    if (saveError) {
      return { success: false, message: saveError };
    }

    return {
      success: true,
      message:
        nextStatus === "completed"
          ? "Indirizzo corretto e posizione confermata."
          : "Indirizzo aggiornato. La posizione richiede ancora verifica.",
      geocode_status: nextStatus,
    };
  } catch (error) {
    const message =
      error instanceof GeoapifyProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Errore geocodifica";

    await saveGeocodeResult(companyId, {
      geocode_status: "needs_review",
      geocoding_error: message,
      geocoding_provider: GEOAPIFY_PROVIDER,
      address: updatedCompany.address,
      street: updatedCompany.street,
      street_number: updatedCompany.street_number,
      postal_code: updatedCompany.postal_code,
      city: updatedCompany.city,
      province: updatedCompany.province,
      country: updatedCompany.country ?? "IT",
    });

    return { success: false, message };
  }
}
