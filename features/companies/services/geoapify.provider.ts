import "server-only";

import { getGeoapifyApiKey } from "@/lib/geoapify/env";

const GEOAPIFY_GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search";
const DEFAULT_TIMEOUT_MS = 10_000;
const PROVIDER_NAME = "geoapify";

export interface GeoapifyGeocodeResult {
  latitude: number;
  longitude: number;
  accuracy: string;
  confidence: number;
  normalizedAddress: string;
}

export interface GeoapifySearchResponse {
  query: string;
  results: GeoapifyGeocodeResult[];
}

export class GeoapifyProviderError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options?: { status?: number; retryable?: boolean }) {
    super(message);
    this.name = "GeoapifyProviderError";
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }
}

export function mapConfidenceToAccuracy(confidence: number | undefined): string {
  if (confidence === undefined || Number.isNaN(confidence)) {
    return "unknown";
  }

  if (confidence >= 0.9) {
    return "high";
  }

  if (confidence >= 0.7) {
    return "medium";
  }

  return "low";
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeoapifyProviderError("Timeout Geoapify", { retryable: true });
    }

    throw new GeoapifyProviderError(
      error instanceof Error ? error.message : "Errore di rete Geoapify",
      { retryable: true }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseGeoapifyRecord(record: unknown): GeoapifyGeocodeResult | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  const row = record as {
    lat?: number;
    lon?: number;
    formatted?: string;
    rank?: { confidence?: number };
  };

  if (
    typeof row.lat !== "number" ||
    typeof row.lon !== "number" ||
    Number.isNaN(row.lat) ||
    Number.isNaN(row.lon)
  ) {
    return null;
  }

  const confidence = row.rank?.confidence ?? 0;

  return {
    latitude: row.lat,
    longitude: row.lon,
    accuracy: mapConfidenceToAccuracy(confidence),
    confidence,
    normalizedAddress: row.formatted?.trim() || "",
  };
}

/**
 * Cerca più candidati Geoapify per valutare ambiguità e confidenza.
 */
export async function searchGeoapify(
  address: string,
  options?: { timeoutMs?: number; limit?: number }
): Promise<GeoapifySearchResponse> {
  const apiKey = getGeoapifyApiKey();
  if (!apiKey) {
    throw new GeoapifyProviderError("GEOAPIFY_API_KEY non configurata");
  }

  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new GeoapifyProviderError("Indirizzo vuoto");
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const limit = options?.limit ?? 5;
  const url = new URL(GEOAPIFY_GEOCODE_URL);
  url.searchParams.set("text", trimmedAddress);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "it");
  url.searchParams.set("apiKey", apiKey);

  const response = await fetchWithTimeout(url.toString(), timeoutMs);

  if (!response.ok) {
    throw new GeoapifyProviderError(`Geoapify HTTP ${response.status}`, {
      status: response.status,
      retryable: isRetryableStatus(response.status),
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GeoapifyProviderError("Risposta Geoapify non valida", {
      retryable: true,
    });
  }

  const rawResults = (payload as { results?: unknown[] }).results;
  const results = (Array.isArray(rawResults) ? rawResults : [])
    .map(parseGeoapifyRecord)
    .filter((result): result is GeoapifyGeocodeResult => result !== null)
    .map((result) => ({
      ...result,
      normalizedAddress: result.normalizedAddress || trimmedAddress,
    }));

  return {
    query: trimmedAddress,
    results,
  };
}

/**
 * Geocodifica un indirizzo tramite Geoapify (primo risultato).
 * Richiede GEOAPIFY_API_KEY lato server — mai esporre al browser.
 */
export async function geocodeWithGeoapify(
  address: string,
  options?: { timeoutMs?: number }
): Promise<Omit<GeoapifyGeocodeResult, "confidence">> {
  const response = await searchGeoapify(address, { ...options, limit: 1 });
  const first = response.results[0];

  if (!first) {
    throw new GeoapifyProviderError("Nessun risultato Geoapify", {
      retryable: false,
    });
  }

  return {
    latitude: first.latitude,
    longitude: first.longitude,
    accuracy: first.accuracy,
    normalizedAddress: first.normalizedAddress,
  };
}

export const GEOAPIFY_PROVIDER = PROVIDER_NAME;

export function isGeoapifyRetryableError(error: unknown): boolean {
  return error instanceof GeoapifyProviderError && error.retryable;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
