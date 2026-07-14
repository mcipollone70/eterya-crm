import type { CommercialStatus } from "@/lib/supabase/types";

/** Colori marker mappa per stato commerciale. */
export const COMMERCIAL_STATUS_MARKER_COLORS: Record<CommercialStatus, string> = {
  prospect: "#2563eb",
  cliente: "#16a34a",
  ex_cliente: "#64748b",
  da_ricontattare: "#ea580c",
  non_interessato: "#dc2626",
};

export const GEOCODED_MAP_STATUSES = ["geocoded", "completed"] as const;

/** PostgREST restituisce al massimo 1000 righe per richiesta. */
export const MAP_FETCH_PAGE_SIZE = 1000;

export const MAP_VIEWPORT_STORAGE_KEY = "eterya-map-viewport";

export const DEFAULT_MAP_CENTER: [number, number] = [41.8719, 12.5674];
export const DEFAULT_MAP_ZOOM = 6;

export const NEARBY_RADIUS_OPTIONS_KM = [2, 5, 10, 20, 50] as const;
export type NearbyRadiusKm = (typeof NEARBY_RADIUS_OPTIONS_KM)[number];

export const NEARBY_COMMERCIAL_STATUS_FILTERS = [
  "prospect",
  "cliente",
  "da_ricontattare",
] as const;

export type NearbyCommercialStatusFilter =
  (typeof NEARBY_COMMERCIAL_STATUS_FILTERS)[number];
