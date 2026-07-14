import type { GeocodeStatus } from "@/lib/supabase/types";

export const GEOCODED_STATUSES: readonly GeocodeStatus[] = ["geocoded", "completed"];

export const GEOCODING_STATUS_LABELS: Record<GeocodeStatus, string> = {
  not_geocoded: "Non geolocalizzata",
  geocoded: "Geolocalizzata",
  pending: "In attesa",
  failed: "Fallita",
  processing: "In elaborazione",
  completed: "Completata",
  needs_review: "Da verificare",
};

export function isGeocodedStatus(status: GeocodeStatus): boolean {
  return GEOCODED_STATUSES.includes(status);
}
