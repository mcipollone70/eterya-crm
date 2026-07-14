import type { CompanyAddressParts } from "./geocode-address-variants";
import { buildGeocodeAddressVariants } from "./geocode-address-variants";

export const GEOCODE_CONFIDENCE_HIGH = 0.9;
export const GEOCODE_CONFIDENCE_ACCEPTABLE = 0.7;
export const GEOCODE_SEARCH_LIMIT = 5;

export interface ResolvedGeocodeCandidate {
  latitude: number;
  longitude: number;
  accuracy: string;
  confidence: number;
  normalizedAddress: string;
}

export type GeocodeResolutionStatus = "completed" | "needs_review" | "failed";

export interface GeocodeResolution {
  status: GeocodeResolutionStatus;
  result: ResolvedGeocodeCandidate | null;
  addressUsed: string | null;
  reason: string | null;
}

export function isAcceptableConfidence(confidence: number): boolean {
  return confidence >= GEOCODE_CONFIDENCE_ACCEPTABLE;
}

export function isHighConfidence(confidence: number): boolean {
  return confidence >= GEOCODE_CONFIDENCE_HIGH;
}

function pickBetterSingle(
  current: { result: ResolvedGeocodeCandidate; variant: string } | null,
  next: ResolvedGeocodeCandidate,
  variant: string
): { result: ResolvedGeocodeCandidate; variant: string } {
  if (!current || next.confidence > current.result.confidence) {
    return { result: next, variant };
  }
  return current;
}

/**
 * Prova le varianti di indirizzo in sequenza.
 * Completata: un solo risultato con confidenza >= 0.7 (alta se >= 0.9).
 * Da verificare: più risultati validi oppure confidenza bassa dopo tutti i tentativi.
 */
export async function resolveGeocodeAddress(
  parts: CompanyAddressParts,
  search: (address: string) => Promise<ResolvedGeocodeCandidate[]>
): Promise<GeocodeResolution> {
  const variants = buildGeocodeAddressVariants(parts);

  if (variants.length === 0) {
    return {
      status: "failed",
      result: null,
      addressUsed: null,
      reason: "Indirizzo insufficiente per la geocodifica",
    };
  }

  let bestSingle: { result: ResolvedGeocodeCandidate; variant: string } | null = null;
  let fallbackMultiple: { result: ResolvedGeocodeCandidate; variant: string } | null = null;
  let sawMultiple = false;

  for (const variant of variants) {
    const results = await search(variant);
    if (results.length === 0) {
      continue;
    }

    if (results.length === 1) {
      const [single] = results;

      if (isHighConfidence(single.confidence)) {
        return {
          status: "completed",
          result: single,
          addressUsed: variant,
          reason: null,
        };
      }

      bestSingle = pickBetterSingle(bestSingle, single, variant);

      if (isAcceptableConfidence(single.confidence)) {
        continue;
      }

      continue;
    }

    sawMultiple = true;
    if (!fallbackMultiple) {
      fallbackMultiple = { result: results[0]!, variant };
    }
  }

  if (bestSingle && isAcceptableConfidence(bestSingle.result.confidence)) {
    return {
      status: "completed",
      result: bestSingle.result,
      addressUsed: bestSingle.variant,
      reason: null,
    };
  }

  if (bestSingle) {
    return {
      status: "needs_review",
      result: bestSingle.result,
      addressUsed: bestSingle.variant,
      reason: sawMultiple
        ? "Più risultati possibili o confidenza bassa"
        : "Confidenza bassa",
    };
  }

  if (fallbackMultiple) {
    return {
      status: "needs_review",
      result: fallbackMultiple.result,
      addressUsed: fallbackMultiple.variant,
      reason: "Più risultati possibili",
    };
  }

  return {
    status: "failed",
    result: null,
    addressUsed: null,
    reason: "Nessun risultato Geoapify",
  };
}
