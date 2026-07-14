import type { CommercialStatus } from "@/lib/supabase/types";
import type { RouteDistanceBand } from "../types/visit-tour";
import { ROUTE_BAND_LIMITS_KM } from "../types/visit-tour";

const COMMERCIAL_PRIORITY: Record<CommercialStatus, number> = {
  da_ricontattare: 100,
  prospect: 85,
  cliente: 60,
  ex_cliente: 35,
  non_interessato: 10,
};

const COMMERCIAL_POTENTIAL: Record<CommercialStatus, number> = {
  prospect: 80,
  da_ricontattare: 75,
  cliente: 55,
  ex_cliente: 30,
  non_interessato: 5,
};

export function getRouteDistanceBand(distanceKm: number): RouteDistanceBand | null {
  if (distanceKm <= ROUTE_BAND_LIMITS_KM["500m"]) {
    return "500m";
  }
  if (distanceKm <= ROUTE_BAND_LIMITS_KM["1km"]) {
    return "1km";
  }
  if (distanceKm <= ROUTE_BAND_LIMITS_KM["2km"]) {
    return "2km";
  }
  return null;
}

export function computePriorityScore(
  commercialStatus: CommercialStatus,
  lastVisitAt: string | null
): number {
  let score = COMMERCIAL_PRIORITY[commercialStatus];

  if (!lastVisitAt) {
    score += 40;
  } else {
    const days = Math.max(
      0,
      (Date.now() - new Date(lastVisitAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    score += Math.min(days * 1.5, 45);
  }

  return score;
}

export function computePotentialScore(
  commercialStatus: CommercialStatus,
  revenue: number | null
): number {
  if (revenue !== null && revenue > 0) {
    return revenue;
  }

  return COMMERCIAL_POTENTIAL[commercialStatus];
}
