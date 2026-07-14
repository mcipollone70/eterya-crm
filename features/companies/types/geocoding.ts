export interface GeocodingSummary {
  withoutCoordinates: number;
  geocoded: number;
  needsReview: number;
  failed: number;
}

export type { GeoapifyConfigLabel, GeoapifyConfigView } from "@/lib/geoapify/types";
export { DEFAULT_GEOAPIFY_CONFIG } from "@/lib/geoapify/types";
export interface CompanyGeocodingBatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  needsReview: number;
  skipped: number;
  message: string;
}

export interface CompanyNeedingReview {
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
  geocoding_normalized_address: string | null;
  originalAddress: string | null;
}

export interface AddressCorrectionInput {
  address?: string | null;
  street?: string | null;
  street_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
}
