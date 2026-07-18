import type { PriorityContext } from "@/lib/commercial-priority/types";
import { computeCompanyPriorityFields } from "@/lib/commercial-priority/compute";
import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import type {
  GeoPoint,
  VisitTourCandidate,
  VisitTourCompany,
  VisitTourRoute,
} from "../types/visit-tour";
import { ROUTE_CORRIDOR_KM } from "../types/visit-tour";
import { minDistanceToRouteKm } from "./route-geometry";
import { computePotentialScore, getRouteDistanceBand } from "./visit-tour-scoring";

export function findCompaniesAlongRoute(
  companies: VisitTourCompany[],
  route: VisitTourRoute,
  context: PriorityContext,
  options?: {
    destinationCompanyId?: string;
    origin?: GeoPoint | null;
    corridorRadiusKm?: number;
  }
): VisitTourCandidate[] {
  const corridorKm = options?.corridorRadiusKm ?? ROUTE_CORRIDOR_KM;
  const candidates: VisitTourCandidate[] = [];

  for (const company of companies) {
    if (options?.destinationCompanyId && company.id === options.destinationCompanyId) {
      continue;
    }

    const distanceFromRouteKm = minDistanceToRouteKm(
      { lat: company.latitude, lng: company.longitude },
      route.coordinates
    );

    const distanceBand = getRouteDistanceBand(distanceFromRouteKm, corridorKm);
    if (!distanceBand || distanceFromRouteKm > corridorKm) {
      continue;
    }

    const distanceFromOriginKm = options?.origin
      ? getDistanceKm(
          options.origin.lat,
          options.origin.lng,
          company.latitude,
          company.longitude
        )
      : null;

    const priority = computeCompanyPriorityFields(company, context, {
      alongActiveRoute: true,
      distanceKm: distanceFromOriginKm,
    });

    if (priority.priority_excluded) {
      continue;
    }

    candidates.push({
      ...company,
      distanceFromRouteKm,
      distanceBand,
      priorityScore: priority.priority_score,
      priorityTier: priority.priority_tier,
      potentialScore: computePotentialScore(company.commercial_status, company.revenue),
    });
  }

  return candidates;
}

export function toGeoPoint(company: { latitude: number; longitude: number }): GeoPoint {
  return { lat: company.latitude, lng: company.longitude };
}
